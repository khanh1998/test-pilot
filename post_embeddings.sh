#!/bin/bash

AUTH_HEADER="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEzLCJlbWFpbCI6InF1b2NraGFuaC5hYmNAZ21haWwuY29tIiwibmFtZSI6IkLDuWkgUXXhu5FjIEtow6FuaCIsImlhdCI6MTc1NTUyNDM5NywiZXhwIjoxNzU1NjEwNzk3fQ.2mGxjkOQhMzBPFiHtoa-7tW1PmKGSS-dYgxGR0e9j9Y"

for i in {467..504}; do
  echo "Posting to ID $i"
  curl -X POST "http://localhost:5173/api/endpoints/$i/embedding" \
    -H "$AUTH_HEADER"
  echo ""  # for newline
done
