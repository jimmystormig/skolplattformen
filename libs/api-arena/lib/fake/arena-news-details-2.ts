export const arenaNewsDetails2 = () =>
  ({
    url: 'https://arena.alingsas.se/news/2',
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
            <div id="block-system-main">
              <div class="submitted">
                <h1><span>Extrainsatt lov</span></h1>
                <span class="date-display-single">19 feb 2022</span>
                <div class="field-name-field-image">
                  <img src="https://raw.githubusercontent.com/jimmystormig/skolplattformen/main/apps/website/assets/img/boys.png" />
                </div>
                <div class="field-name-field-introduction">
                  <span class="field-item">Intro...</span>
                </div>
              </div>
            </div>
          </body>
        </html>`
      ),
  } as any as Response)
