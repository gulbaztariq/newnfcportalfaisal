# hostinger branch

Same code as `main`, with the website already built (`client/dist` is committed) so Hostinger does not have to run the client build,
which crashes on shared hosting. `npm run build` installs only the server packages and `npm start` starts the server (no database sync).

Update it after changes on `main`:
    git checkout hostinger && git merge main
    (cd client && npm ci --include=dev && npm run build) && git add -f client/dist && git commit -am "Rebuild site" && git push target hostinger
Run `npm run db:update` over SSH after updates that add tables.
