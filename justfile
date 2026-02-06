install:
    npm install
dev:
    npm run dev
build:
    npm run build

send-update: build
    rsync -arv static/ lostartefacts.dev:srv/TRXBarsEditor/static/
    ssh lostartefacts.dev 'cd srv/TRXBarsEditor; git fetch; git reset --hard origin/main'
