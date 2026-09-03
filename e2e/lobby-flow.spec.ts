import { expect, test } from 'playwright/test';

test('a student can create a QR room and another browser can join from its invite URL', async ({ browser, page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('실시간 서버에 연결됨');
  await page.getByLabel('내 별명').fill('방장');
  await page.getByLabel('방 이름').fill('1학년 2반');
  await page.getByRole('button', { name: '방 만들기' }).click();

  await expect(page.getByText('친구 초대하기')).toBeVisible();
  const inviteUrl = await page.getByLabel('초대 링크').inputValue();
  expect(inviteUrl).toMatch(/^http:\/\/127\.0\.0\.1:5173\/room\/[A-F0-9]{8}\?token=[a-f0-9]{32}$/);

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(inviteUrl);
  await guestPage.getByLabel('내 별명').fill('하늘');
  await guestPage.getByRole('button', { name: '방 입장' }).click();

  await expect(guestPage.getByText('현재 입장 인원: 2명')).toBeVisible();
  await expect(page.getByText('현재 입장 인원: 2명')).toBeVisible();
  await guestContext.close();
});

test('four browsers receive private roles and complete an automatic round through a public vote', async ({ browser, page }) => {
  const guestContexts = [];
  try {
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('실시간 서버에 연결됨');
    await page.getByLabel('내 별명').fill('방장');
    await page.getByLabel('방 이름').fill('전체 게임 방');
    await page.getByLabel('단계 시간(초)').fill('10');
    await page.getByRole('button', { name: '방 만들기' }).click();
    const inviteUrl = await page.getByLabel('초대 링크').inputValue();

    const players = [{ nickname: '하늘' }, { nickname: '바다' }, { nickname: '별' }];
    for (const player of players) {
      const context = await browser.newContext();
      const playerPage = await context.newPage();
      await playerPage.goto(inviteUrl);
      await playerPage.getByLabel('내 별명').fill(player.nickname);
      await playerPage.getByRole('button', { name: '방 입장' }).click();
      guestContexts.push({ ...player, context, page: playerPage });
    }
    const allPlayers = [{ nickname: '방장', page }, ...guestContexts];
    await expect(page.getByText('현재 입장 인원: 4명')).toBeVisible();
    await page.getByRole('button', { name: '게임 시작' }).click();

    await expect(page.getByRole('timer')).toHaveText(/남은 시간: \d+초/);
    await Promise.all(allPlayers.map(({ page: playerPage }) =>
      expect(playerPage.getByText(/^나의 역할:/)).toBeVisible()
    ));
    let mafia: (typeof allPlayers)[number] | undefined;
    for (const candidate of allPlayers) {
      if (await candidate.page.getByText('나의 역할: 마피아').isVisible()) {
        mafia = candidate;
        break;
      }
    }
    if (!mafia) {
      throw new Error('The four-player preset must assign one mafia browser.');
    }

    await Promise.all(allPlayers.map(({ page: playerPage }) =>
      expect(playerPage.getByText('낮: 투표하는 시간')).toBeVisible({ timeout: 40_000 })
    ));
    await Promise.all(allPlayers.map(({ page: playerPage }) =>
      playerPage.getByRole('button', { name: `${mafia.nickname}에게 투표` }).click()
    ));
    await Promise.all(allPlayers.map(({ page: playerPage }) =>
      expect(playerPage.getByText('시민 팀 승리')).toBeVisible({ timeout: 15_000 })
    ));

    await page.getByRole('button', { name: '재경기 시작' }).click();
    await expect(page.getByText('역할을 확인하는 시간')).toBeVisible();
    await Promise.all(allPlayers.map(({ page: playerPage }) =>
      expect(playerPage.getByText(/^나의 역할:/)).toBeVisible()
    ));
  } finally {
    await Promise.all(guestContexts.map(({ context }) => context.close()));
  }
});
