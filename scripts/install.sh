#!/usr/bin/env sh
# Installs or updates Jucosuma as a systemd service, removes it with --uninstall.
#
#   sudo ./scripts/install.sh                        # bin/jucosuma-v<VERSION>-linux-<arch> → /usr/local/bin/jucosuma
#   sudo ./scripts/install.sh --dir /opt/jucosuma    # binary → /opt/jucosuma/jucosuma
#   sudo ./scripts/install.sh --binary ./jucosuma-v0.13.1-linux-amd64 --port 9000
#   sudo ./scripts/install.sh --uninstall [--purge]  # --purge also deletes data and configuration
#
# Running it again updates the binary (where it was installed before) and restarts the service; the
# configuration is kept. Configuration: /etc/<app>/<app>.env  Data: /var/lib/<app>  Logs: journalctl -u <app> -f
set -eu

# Reusable for other single-binary apps (e.g. ragbag): adjust these lines and write_env_file
APP=jucosuma
DESCRIPTION="Jucosuma household budget book"
DEFAULT_PORT=8080

DEFAULT_DIR=/usr/local/bin
CONFIG_DIR="/etc/$APP"
ENV_FILE="$CONFIG_DIR/$APP.env"
DATA_DIR="/var/lib/$APP"
UNIT_FILE="/etc/systemd/system/$APP.service"

binary=""
port="$DEFAULT_PORT"
dir=""
action=install
purge=false

usage() {
	sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
	exit "${1:-0}"
}

while [ $# -gt 0 ]; do
	case "$1" in
		--binary) binary="$2"; shift 2 ;;
		--port) port="$2"; shift 2 ;;
		--dir) dir="${2%/}"; shift 2 ;;
		--uninstall) action=uninstall; shift ;;
		--purge) purge=true; shift ;;
		-h | --help) usage ;;
		*) echo "Unknown option: $1" >&2; usage 1 ;;
	esac
done

[ "$(id -u)" -eq 0 ] || { echo "Please run as root (sudo $0 $*)" >&2; exit 1; }
command -v systemctl >/dev/null || { echo "systemd is required" >&2; exit 1; }

# Without --dir, updates and uninstall use the location of the existing installation
installed_path=$(sed -n 's/^ExecStart=//p' "$UNIT_FILE" 2>/dev/null || true)
if [ -n "$dir" ]; then
	BIN_PATH="$dir/$APP"
elif [ -n "$installed_path" ]; then
	BIN_PATH="$installed_path"
else
	BIN_PATH="$DEFAULT_DIR/$APP"
fi

# make build names binaries bin/jucosuma-v<version>-linux-<arch>. Only the current VERSION is taken, so an old
# build lying around in bin/ is never installed by accident.
default_binary() {
	case "$(uname -m)" in
		x86_64 | amd64) arch=amd64 ;;
		aarch64 | arm64) arch=arm64 ;;
		*) arch=$(uname -m) ;;
	esac
	if [ -f VERSION ]; then
		echo "bin/$APP-v$(cat VERSION)-linux-$arch"
	else
		ls bin/"$APP"-v*-linux-"$arch" 2>/dev/null | sort -V | tail -n 1
	fi
}

# Removes the binary and its directory if it is one of its own (e.g. /opt/jucosuma) and empty now.
remove_binary() {
	rm -f "$1"
	bin_dir=$(dirname "$1")
	if [ "$(basename "$bin_dir")" = "$APP" ]; then
		rmdir "$bin_dir" 2>/dev/null || true
	fi
}

uninstall() {
	systemctl disable --now "$APP" 2>/dev/null || true
	rm -f "$UNIT_FILE"
	remove_binary "$BIN_PATH"
	systemctl daemon-reload
	if [ "$purge" = true ]; then
		# DynamicUser keeps the state below /var/lib/private
		rm -rf "$CONFIG_DIR" "$DATA_DIR" "/var/lib/private/$APP"
		echo "$APP removed, including data and configuration."
	else
		echo "$APP removed. Data ($DATA_DIR) and configuration ($CONFIG_DIR) were kept; --purge deletes them."
	fi
}

write_env_file() {
	mkdir -p "$CONFIG_DIR"
	install -m 0644 /dev/null "$ENV_FILE"
	cat >"$ENV_FILE" <<ENV
# Configuration of $APP, see README.md for all options.
# Apply changes with: sudo systemctl restart $APP

ADDR=:$port
DB_PATH=$DATA_DIR/$APP.db
UPLOADS_DIR=$DATA_DIR/uploads

# Daily database backups go to $DATA_DIR/backups; 0 disables them (admins can change it in the settings)
BACKUP_KEEP=14
ENV
	echo "Created $ENV_FILE"
}

write_unit_file() {
	install -m 0644 /dev/null "$UNIT_FILE"
	cat >"$UNIT_FILE" <<UNIT
[Unit]
Description=$DESCRIPTION
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=$BIN_PATH
EnvironmentFile=$ENV_FILE
# systemd creates a throwaway unprivileged user and $DATA_DIR owned by it
DynamicUser=yes
StateDirectory=$APP
# The first start writes admin_password.txt here
WorkingDirectory=$DATA_DIR
Restart=on-failure
RestartSec=5

# Hardening: the service can only write its state directory
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

[Install]
WantedBy=multi-user.target
UNIT
}

install_app() {
	[ -n "$binary" ] || binary=$(default_binary)
	[ -n "$binary" ] && [ -f "$binary" ] || {
		echo "Binary not found: ${binary:-bin/$APP-v<version>-linux-<arch>}. Build it with 'make build' or pass --binary <file>" >&2
		exit 1
	}
	updating=false
	[ -n "$installed_path" ] && updating=true

	if [ -n "$installed_path" ] && [ "$installed_path" != "$BIN_PATH" ]; then
		echo "Moving the binary from $installed_path to $BIN_PATH"
		remove_binary "$installed_path"
	fi
	install -d -m 0755 "$(dirname "$BIN_PATH")"
	install -m 0755 "$binary" "$BIN_PATH"
	# SELinux (Fedora, RHEL): give the copy the label of its new location so systemd may execute it
	command -v restorecon >/dev/null && restorecon "$BIN_PATH" 2>/dev/null || true
	[ -f "$ENV_FILE" ] || write_env_file
	write_unit_file
	systemctl daemon-reload
	systemctl enable "$APP" >/dev/null 2>&1
	systemctl restart "$APP"

	sleep 2
	if ! systemctl is-active --quiet "$APP"; then
		echo "$APP did not start, see: journalctl -u $APP -n 50" >&2
		journalctl -u "$APP" -n 20 --no-pager >&2 || true
		exit 1
	fi
	configured_port=$(sed -n 's/^ADDR=.*:\([0-9]*\)$/\1/p' "$ENV_FILE")
	[ "$updating" = true ] && echo "$APP updated and restarted ($binary)." || echo "$APP installed and started ($binary)."
	echo "  Open:    http://$(hostname):${configured_port:-$port}"
	if [ "$updating" = false ] && [ -f "$DATA_DIR/admin_password.txt" ]; then
		echo "  Login:   admin, password: sudo cat $DATA_DIR/admin_password.txt (change it on the first login)"
	fi
	echo "  Binary:  $BIN_PATH"
	echo "  Config:  $ENV_FILE (then: sudo systemctl restart $APP)"
	echo "  Data:    $DATA_DIR (database, uploads, backups)"
	echo "  Logs:    journalctl -u $APP -f"
}

case "$action" in
	install) install_app ;;
	uninstall) uninstall ;;
esac
