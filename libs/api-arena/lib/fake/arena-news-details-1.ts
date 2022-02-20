export const arenaNewsDetails1 = () =>
  ({
    url: 'https://arena.alingsas.se/news/1',
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
                <h1><span>Vi firar potatisen</span></h1>
                <span class="date-display-single">20 feb 2022</span>
                <div class="field-name-field-image">
                  <img src="https://raw.githubusercontent.com/jimmystormig/skolplattformen/main/apps/website/assets/img/logo.png" />
                </div>
                <div class="field-name-field-introduction">
                  <span class="field-item">Jonas Alströmers ättling kommer på besök och berättar hur hans förfader uppfann potatisen.</span>
                </div>
                <div class="field-name-body">
                  <span class="field-item">
Lorum ispum
<ul>
  <li>Första punkten</li>
  <li>Andra punkten</li>
</ul>
                  </span>
                </div>
              </div>
            </div>
          </body>
        </html>`
      ),
  } as any as Response)
