package main

import (
	"net/http"
	"strconv"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func (app *application) getUsers(c echo.Context) error {
	users, err := app.queries.FindAllUsers(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(users, dtos.MapUserToUserDto))
}

func (app *application) createUser(c echo.Context) error {
	var payload dtos.CreateUserDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
	}

	user, err := app.queries.InsertUser(c.Request().Context(), sqlc.InsertUserParams{
		Username:           payload.Username,
		Password:           string(hash),
		Role:               payload.Role,
		MustChangePassword: 1,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create user: "+err.Error())
	}

	return c.JSON(http.StatusCreated, dtos.MapUserToUserDto(user))
}

func (app *application) updateUser(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	var payload dtos.UpdateUserDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	err = app.queries.UpdateUser(c.Request().Context(), sqlc.UpdateUserParams{
		ID:       id,
		Username: payload.Username,
		Role:     payload.Role,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update user: "+err.Error())
	}

	user, err := app.queries.FindUserById(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, dtos.MapUserToUserDto(user))
}

func (app *application) deleteUser(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	currentUser := c.Get("user").(sqlc.User)
	if currentUser.ID == id {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot delete yourself")
	}

	target, err := app.queries.FindUserById(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}
	if target.Username == "admin" {
		return echo.NewHTTPError(http.StatusBadRequest, "the admin user cannot be deleted")
	}

	_ = app.queries.DeleteSessionsByUserId(c.Request().Context(), id)
	err = app.queries.DeleteUser(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete user: "+err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (app *application) resetUserPassword(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	var payload dtos.ResetPasswordDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
	}

	// UpdateUserPassword also sets must_change_password = 0,
	// but for admin reset we want must_change_password = 1.
	// So we update password first, then set the flag manually via a direct query.
	err = app.queries.UpdateUserPassword(c.Request().Context(), sqlc.UpdateUserPasswordParams{
		ID:       id,
		Password: string(hash),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to reset password")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "password reset"})
}
