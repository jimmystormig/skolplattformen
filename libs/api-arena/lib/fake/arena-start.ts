export const arenaStart = () =>
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
        '<html><body><div class="children"><div class="child"><div class="child-block"><h2>Ulla-Bella Habib</h2></div></div></div></body></html>'
      ),
  } as any as Response)
