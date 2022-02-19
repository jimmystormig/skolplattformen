export const skola24LoginNovaSSO = () =>
  ({
    url: 'https://skola24.se/login/nova/sso',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36',
      cookie: 'REMOVED',
    },
    status: 200,
    statusText: '200',
    text: () => Promise.resolve(''),
  } as any as Response)
