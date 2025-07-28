#!/bin/bash

AUTH_HEADER="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEzLCJlbWFpbCI6InF1b2NraGFuaC5hYmNAZ21haWwuY29tIiwibmFtZSI6IkLDuWkgUXXhu5FjIEtow6FuaCIsImlhdCI6MTc1MzY3NTQ3MiwiZXhwIjoxNzUzNzYxODcyfQ.k3sy4RV3-orVY2ZMkfo5wmbESjnBjMEKlux2MGgQuHQ"

for i in {1..100}; do
  echo "Posting to ID $i"
  curl -X POST "http://localhost:5173/api/endpoints/$i/embedding" \
    -H "$AUTH_HEADER"
  echo ""  # for newline
done
