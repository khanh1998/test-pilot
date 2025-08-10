#!/bin/bash

AUTH_HEADER="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEzLCJlbWFpbCI6InF1b2NraGFuaC5hYmNAZ21haWwuY29tIiwibmFtZSI6IkLDuWkgUXXhu5FjIEtow6FuaCIsImlhdCI6MTc1NDU2MDgzNCwiZXhwIjoxNzU0NjQ3MjM0fQ.7TsqynfzFqj2w5NmwRjrIlsGdqcpHEPPVmveqZ_-5UU"

for i in {474..474}; do
  echo "Posting to ID $i"
  curl -X POST "http://localhost:5173/api/endpoints/$i/embedding" \
    -H "$AUTH_HEADER"
  echo ""  # for newline
done
