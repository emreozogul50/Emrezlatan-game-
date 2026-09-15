#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js kurulu degil: https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install
[ -f .env ] || cp .env.example .env
(sleep 2 && open http://localhost:3000) &
npm start
