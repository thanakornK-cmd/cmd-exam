# Event Register Backend

## Run

```bash
cp .env.example .env
go run ./cmd/api
```

## Notes

- The API is exposed at `http://localhost:8080/api/v1`
- Admin credentials default to `admin` / `admin12345`
- Set `DATABASE_URL` in your deployment environment if you want the app to receive a Postgres connection string.
- The current backend still persists registrations in `./data/state.json`; `DATABASE_URL` is not used for storage yet.
- Uploaded files are stored under `./data/uploads`
