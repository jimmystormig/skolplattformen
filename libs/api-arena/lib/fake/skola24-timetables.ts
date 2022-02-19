export const skola24Timetables = () =>
  ({
    url: 'https://skola24.se/timetables',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36',
      cookie: 'REMOVED',
    },
    status: 200,
    statusText: '200',
    json: () =>
      Promise.resolve({
        data: {
          getPersonalTimetablesResponse: {
            childrenTimetables: [{}],
          },
        },
      }),
  } as any as Response)
