export const arenaCurrentUser = () =>
  ({
    url: 'https://arena.alingsas.se',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
      cookie: 'REMOVED',
    },
    status: 200,
    statusText: '200',
    text: () =>
      Promise.resolve(
        `<html>
          <body>
            <div class="field-name-field-firstname">
              <span class="field-item">Johan</span>
            </div>
            <div class="field-name-field-lastname">
              <span class="field-item">Alströmer</span>
            </div>
            <div class="field-name-field-user-email">
              <span class="field-item">johan@alstromer.se</span>
            </div>
          </body>
        </html>`
      ),
  } as any as Response)
