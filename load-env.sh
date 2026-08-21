# Loads .env into the current shell's environment. Meant to be sourced
# (`. ./load-env.sh` or `source ./load-env.sh`), not executed directly.
#
# Unlike a plain `source .env`, this doesn't break on unquoted values that
# contain spaces (e.g. COMPANY_NAME=Yun Shang Pte Ltd gets word-split by
# bash and run as a command — "Shang: command not found") — which is how
# Docker Compose's own .env parser already treats them, no quoting
# required. Quoted values still work fine too (surrounding quotes are
# stripped either way).
if [ ! -f .env ]; then
  echo ".env not found — copy .env.example to .env and fill it in first." >&2
  return 1 2>/dev/null || exit 1
fi

set -a
while IFS='=' read -r key value; do
  case "$key" in
    ""|\#*) continue ;;
  esac
  value="${value%\"}"
  value="${value#\"}"
  export "$key=$value"
done < .env
set +a
