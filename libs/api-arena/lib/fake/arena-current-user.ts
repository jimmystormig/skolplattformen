export const arenaCurrentUser = () =>
  ({
    url: 'https://arena.alingsas.se',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36',
      cookie: 'REMOVED',
    },
    status: 200,
    statusText: '200',
    text: () =>
      Promise.resolve(
        '<html><body><div class="field-name-field-firstname"><span class="field-item">Ulla Bella</span></div><div class="field-name-field-lastname"><span class="field-item">Habib</span></div><div class="field-name-field-email"><span class="field-item">ulla-bella@habib.se</span></div></body></html>'
      ),
  } as any as Response)
