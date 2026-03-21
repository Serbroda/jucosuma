package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"os"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"golang.org/x/crypto/bcrypt"
)

const passwordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*"

func generateRandomPassword(length int) (string, error) {
	result := make([]byte, length)
	for i := range result {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(passwordChars))))
		if err != nil {
			return "", err
		}
		result[i] = passwordChars[num.Int64()]
	}
	return string(result), nil
}

func (app *application) seedAdmin(passwordFile string) error {
	ctx := context.Background()
	count, err := app.queries.CountUsers(ctx)
	if err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil
	}

	password, err := generateRandomPassword(16)
	if err != nil {
		return fmt.Errorf("generate password: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	_, err = app.queries.InsertUser(ctx, sqlc.InsertUserParams{
		Username:           "admin",
		Password:           string(hash),
		Role:               "admin",
		MustChangePassword: 1,
	})
	if err != nil {
		return fmt.Errorf("insert admin: %w", err)
	}

	if err := os.WriteFile(passwordFile, []byte(password), 0600); err != nil {
		return fmt.Errorf("write password file: %w", err)
	}

	log.Printf("Admin user created. Password written to: %s", passwordFile)
	return nil
}
