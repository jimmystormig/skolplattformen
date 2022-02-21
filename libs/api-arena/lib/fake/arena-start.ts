export const arenaStart = () =>
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
            <div class="children">
              <div class="child">
                <div class="child-block">
                  <h2>Anna Alströmer</h2>
                  <ul class="arena-guardian-child-info">
                    <li class="news-and-infoblock-item">
                      <a href="https://arena.alingsas.se/news/1">Vi firar potatisen »</a>
                    </li>
                    <li class="news-and-infoblock-item">
                      <a class="node-viewed" href="https://arena.alingsas.se/news/2">Extrainsatt lov »</a>
                    </li>
                  </ul>
                </div>
              </div>
              <div class="child">
                <div class="child-block">
                  <h2>Albin Alströmer</h2>
                </div>
              </div>
            </div>
          </body>
        </html>`
      ),
  } as any as Response)
