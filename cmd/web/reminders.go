package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/notify"
)

// Reminder types. Every user decides per type and channel what they receive.
const (
	reminderDeadline     = "deadline"      // cancellation deadline of a contract (30 and 7 days before)
	reminderContractEnd  = "contract_end"  // contract with end date runs out (30 days before)
	reminderPayment      = "payment"       // non-monthly payment (yearly, quarterly, one-off) in the next 7 days
	reminderAmountChange = "amount_change" // planned amount change in the next 7 days
	reminderClosing      = "closing"       // previous month not closed (on the 2nd and the 7th)
	reminderBackupFailed = "backup_failed" // admins: the daily backup failed
)

var reminderTypes = []string{reminderDeadline, reminderContractEnd, reminderPayment, reminderAmountChange, reminderClosing}

// reminderTypesFor returns the types a user can receive (backup failures only for admins).
func reminderTypesFor(user sqlc.User) []string {
	if user.Role == "admin" {
		return append(append([]string{}, reminderTypes...), reminderBackupFailed)
	}
	return reminderTypes
}

const inAppChannel = "inapp"

// reminder is a notification to be created for a user (once per dedupe key).
type reminder struct {
	Type  string
	Key   string
	Title string
	Body  string
	Link  string // path in the app, e.g. /contracts/12
}

// StartReminders checks for due reminders every hour (and once shortly after start).
func (app *application) StartReminders() {
	go func() {
		time.Sleep(10 * time.Second)
		for {
			if n, err := app.generateReminders(context.Background(), time.Now()); err != nil {
				log.Printf("Reminders failed: %v", err)
			} else if n > 0 {
				log.Printf("Reminders: %d new", n)
			}
			time.Sleep(time.Hour)
		}
	}()
}

// generateReminders creates the due reminders for all users and delivers new ones to their
// channels. It returns the number of new notifications.
func (app *application) generateReminders(ctx context.Context, now time.Time) (int, error) {
	users, err := app.queries.FindAllUsers(ctx)
	if err != nil {
		return 0, err
	}
	contracts, err := app.queries.FindAllContracts(ctx)
	if err != nil {
		return 0, err
	}
	entries, err := app.mapContracts(ctx, contracts)
	if err != nil {
		return 0, err
	}
	accounts, err := app.queries.FindAllAccounts(ctx)
	if err != nil {
		return 0, err
	}
	accountNames := map[int64]string{}
	for _, a := range accounts {
		accountNames[a.ID] = a.Name
	}
	closings, err := app.queries.FindAllMonthClosings(ctx)
	if err != nil {
		return 0, err
	}
	closed := map[string]bool{}
	for _, c := range closings {
		closed[c.Month] = true
	}

	created := 0
	for _, user := range users {
		t := app.texts(ctx, user)
		var due []reminder
		for _, e := range entries {
			if e.OwnerID != nil && *e.OwnerID != user.ID {
				continue // private entries of others
			}
			due = append(due, entryReminders(e, now, t, accountNames)...)
		}
		// monthly closing: only once the household uses closings
		if len(closings) > 0 {
			due = append(due, closingReminders(now, closed, t)...)
		}
		n, err := app.createReminders(ctx, user, due)
		if err != nil {
			return created, err
		}
		created += n
	}

	// read and unread notifications are kept for half a year
	if err := app.queries.DeleteOldNotifications(ctx, now.AddDate(0, -6, 0)); err != nil {
		return created, err
	}
	return created, nil
}

// entryReminders returns the reminders of an entry that are due at `now`.
func entryReminders(e dtos.ContractDto, now time.Time, t texts, accountNames map[int64]string) []reminder {
	today := civilDate(now)
	link := fmt.Sprintf("/contracts/%d", e.ID)
	var result []reminder
	if e.Status == dtos.ContractStatusExpired {
		return nil
	}

	if e.IsContract && e.CancelBy != nil {
		days := daysBetween(today, time.Time(*e.CancelBy))
		if days >= 0 && days <= 30 {
			stage := 30
			if days <= 7 {
				stage = 7
			}
			body := t.f("deadlineBody", time.Time(*e.CancelBy).Format(t.dateFormat), t.inDays(days))
			if e.TermEnd != nil {
				body += " " + t.f("deadlineRenewal", time.Time(*e.TermEnd).Format(t.dateFormat))
			}
			result = append(result, reminder{
				Type: reminderDeadline, Key: fmt.Sprintf("deadline:%d:%s:%d", e.ID, dateKey(*e.CancelBy), stage),
				Title: t.f("deadlineTitle", e.Name), Body: body, Link: link,
			})
		}
	}

	if e.IsContract && e.EndDate != nil {
		days := daysBetween(today, time.Time(*e.EndDate))
		if days >= 0 && days <= 30 {
			result = append(result, reminder{
				Type: reminderContractEnd, Key: fmt.Sprintf("end:%d:%s", e.ID, dateKey(*e.EndDate)),
				Title: t.f("endTitle", e.Name), Body: t.f("endBody", time.Time(*e.EndDate).Format(t.dateFormat), t.inDays(days)), Link: link,
			})
		}
	}

	if e.Kind == dtos.EntryKindExpense {
		if date := irregularPaymentDate(e); date != nil {
			days := daysBetween(today, *date)
			if days >= 0 && days <= 7 {
				amount := t.money(costsAt(e, *date), e.Currency)
				body := t.f("paymentBody", t.inDays(days), date.Format(t.dateFormat), amount)
				if e.AccountID != nil && accountNames[*e.AccountID] != "" {
					body += " " + t.f("paymentFrom", accountNames[*e.AccountID])
				}
				result = append(result, reminder{
					Type: reminderPayment, Key: fmt.Sprintf("payment:%d:%s", e.ID, date.Format("2006-01-02")),
					Title: t.f("paymentTitle", e.Name), Body: body, Link: link,
				})
			}
		}
	}

	for i, a := range e.Amounts {
		days := daysBetween(today, time.Time(a.ValidFrom))
		if days < 0 || days > 7 {
			continue
		}
		previous := e.BaseCosts
		if i > 0 {
			previous = &e.Amounts[i-1].Costs
		}
		body := t.f("amountBody", time.Time(a.ValidFrom).Format(t.dateFormat), t.money(a.Costs, e.Currency))
		if previous != nil {
			body += " " + t.f("amountInstead", t.money(*previous, e.Currency))
		}
		result = append(result, reminder{
			Type: reminderAmountChange, Key: fmt.Sprintf("amount:%d", a.ID),
			Title: t.f("amountTitle", e.Name), Body: body, Link: link,
		})
	}
	return result
}

// irregularPaymentDate is the next date of a payment that is not monthly or weekly.
func irregularPaymentDate(e dtos.ContractDto) *time.Time {
	switch strings.ToLower(e.BillingPeriod) {
	case string(dtos.BillingPeriodOneTime):
		d := time.Time(e.StartDate)
		return &d
	case string(dtos.BillingPeriodMonthly), string(dtos.BillingPeriodWeekly), string(dtos.BillingPeriodNone):
		return nil
	}
	if e.NextBillingDate == nil {
		return nil
	}
	d := time.Time(*e.NextBillingDate)
	return &d
}

// costsAt is the amount of a payment valid at a date (amount history).
func costsAt(e dtos.ContractDto, date time.Time) float64 {
	costs := 0.0
	if e.BaseCosts != nil {
		costs = *e.BaseCosts
	} else if e.Costs != nil {
		costs = *e.Costs
	}
	for _, a := range e.Amounts {
		if !time.Time(a.ValidFrom).After(date) {
			costs = a.Costs
		}
	}
	return costs
}

// closingReminders: the previous month is not closed – on the 2nd and again from the 7th.
func closingReminders(now time.Time, closed map[string]bool, t texts) []reminder {
	if now.Day() < 2 {
		return nil
	}
	previous := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -1, 0)
	month := previous.Format("2006-01")
	if closed[month] {
		return nil
	}
	stage := 1
	if now.Day() >= 7 {
		stage = 2
	}
	name := t.monthName(previous)
	return []reminder{{
		Type: reminderClosing, Key: fmt.Sprintf("closing:%s:%d", month, stage),
		Title: t.f("closingTitle", name), Body: t.f("closingBody", name), Link: "/closing?month=" + month,
	}}
}

// notifyAdmins creates a reminder for all admins (e.g. a failed backup).
func (app *application) notifyAdmins(ctx context.Context, build func(t texts) reminder) {
	users, err := app.queries.FindAllUsers(ctx)
	if err != nil {
		log.Printf("Notify admins: %v", err)
		return
	}
	for _, u := range users {
		if u.Role != "admin" {
			continue
		}
		if _, err := app.createReminders(ctx, u, []reminder{build(app.texts(ctx, u))}); err != nil {
			log.Printf("Notify admins: %v", err)
		}
	}
}

// createReminders stores new reminders of a user (known dedupe keys are skipped) and sends
// them to the user's channels according to the preferences. It returns the number of new ones.
func (app *application) createReminders(ctx context.Context, user sqlc.User, due []reminder) (int, error) {
	if len(due) == 0 {
		return 0, nil
	}
	prefs, err := app.preferenceLookup(ctx, user.ID)
	if err != nil {
		return 0, err
	}
	channels, err := app.queries.FindNotificationChannelsForUser(ctx, user.ID)
	if err != nil {
		return 0, err
	}
	server := app.notifyServer(ctx)

	created := 0
	for _, r := range due {
		var link *string
		if r.Link != "" {
			link = &r.Link
		}
		_, err := app.queries.InsertNotification(ctx, sqlc.InsertNotificationParams{
			UserID: user.ID, Type: r.Type, DedupeKey: r.Key, Title: r.Title, Body: r.Body, Link: link,
			InApp: boolToInt64(prefs(r.Type, inAppChannel)),
		})
		if errors.Is(err, sql.ErrNoRows) {
			continue // already created earlier
		}
		if err != nil {
			return created, err
		}
		created++
		msg := notify.Message{Type: r.Type, Title: r.Title, Body: r.Body, Link: absoluteLink(server.PublicURL, r.Link)}
		for _, ch := range channels {
			if ch.Enabled == 0 || !prefs(r.Type, strconv.FormatInt(ch.ID, 10)) {
				continue
			}
			if err := sendTo(ctx, ch, server, msg); err != nil {
				log.Printf("Reminder %s to %s channel %d of %s: %v", r.Key, ch.Kind, ch.ID, user.Username, err)
			}
		}
	}
	return created, nil
}

func sendTo(ctx context.Context, ch sqlc.NotificationChannel, server notify.Server, msg notify.Message) error {
	channel, err := notify.Get(ch.Kind)
	if err != nil {
		return err
	}
	if !channel.Available(server) {
		return fmt.Errorf("channel %s not available", ch.Kind)
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	return channel.Send(ctx, json.RawMessage(ch.Config), server, msg)
}

// preferenceLookup returns whether a reminder type goes to a channel; without a stored choice it does.
func (app *application) preferenceLookup(ctx context.Context, userID int64) (func(typ, channel string) bool, error) {
	rows, err := app.queries.FindNotificationPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}
	stored := map[string]bool{}
	for _, p := range rows {
		stored[p.Type+"|"+p.Channel] = p.Enabled == 1
	}
	return func(typ, channel string) bool {
		if enabled, ok := stored[typ+"|"+channel]; ok {
			return enabled
		}
		return true
	}, nil
}

// absoluteLink turns an app path into a link for external channels (hash router).
func absoluteLink(publicURL, path string) string {
	if publicURL == "" || path == "" {
		return ""
	}
	return strings.TrimRight(publicURL, "/") + "/#" + path
}

func civilDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func daysBetween(from, to time.Time) int {
	to = time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC)
	return int(to.Sub(from).Hours() / 24)
}

func dateKey(d dtos.DateOnly) string {
	return time.Time(d).Format("2006-01-02")
}
