package main

import (
	"net/http"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

const sessionMaxAge = 30 * 24 * 3600 // 30 days

func (app *application) login(c echo.Context) error {
	var payload dtos.LoginDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	user, err := app.queries.FindUserByUsername(c.Request().Context(), payload.Username)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(payload.Password)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
	}

	sessionID := uuid.NewString()
	expiresAt := time.Now().Add(time.Duration(sessionMaxAge) * time.Second)

	_, err = app.queries.InsertSession(c.Request().Context(), sqlc.InsertSessionParams{
		ID:        sessionID,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create session")
	}

	c.SetCookie(&http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Path:     "/",
		MaxAge:   sessionMaxAge,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	return c.JSON(http.StatusOK, dtos.MapUserToUserDto(user))
}

func (app *application) logout(c echo.Context) error {
	cookie, err := c.Cookie("session_id")
	if err == nil && cookie.Value != "" {
		_ = app.queries.DeleteSession(c.Request().Context(), cookie.Value)
	}

	c.SetCookie(&http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	return c.NoContent(http.StatusOK)
}

func (app *application) me(c echo.Context) error {
	user := c.Get("user").(sqlc.User)
	return c.JSON(http.StatusOK, dtos.MapUserToUserDto(user))
}

func (app *application) changePassword(c echo.Context) error {
	var payload dtos.ChangePasswordDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	user := c.Get("user").(sqlc.User)

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(payload.CurrentPassword)); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "current password is incorrect")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(payload.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
	}

	err = app.queries.UpdateUserPassword(c.Request().Context(), sqlc.UpdateUserPasswordParams{
		ID:       user.ID,
		Password: string(hash),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update password")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "password changed"})
}
