package main

import (
	"fmt"
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"net/http"
)

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
	return cv.validator.Struct(i)
}

func BindAndValidate(ctx echo.Context, payload interface{}) error {
	if err := ctx.Bind(payload); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}
	if err := ctx.Validate(payload); err != nil {
		msg := "Validation failed: "
		for _, err := range err.(validator.ValidationErrors) {
			msg += fmt.Sprintf("Field '%s' failed validation. Condition: '%s'\n", err.Field(), err.Tag())
		}
		return echo.NewHTTPError(http.StatusBadRequest, msg)
	}
	return nil
}
