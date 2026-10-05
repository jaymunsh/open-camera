import { expect, test, type Page } from '@playwright/test';

async function enableSummary(page: Page) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('switch', { name: '설정 요약 표시', exact: true }).click();
}

// Catches accidental default-on, a stale one-time snapshot, and preference writes to camera settings.
test('summary is opt-in, survives reload and follows changes without altering camera settings', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: '설정 요약', exact: true })).toHaveCount(0);
  await enableSummary(page);
  const summary = page.getByRole('region', { name: '설정 요약', exact: true });
  await expect(summary).toContainText('원본'); await expect(summary).toContainText('3:4');
  await page.getByRole('button', { name: '비율', exact: true }).click();
  await expect(summary).toContainText('9:16');
  await summary.getByRole('button', { name: '설정 요약 접기', exact: true }).click();
  await summary.getByRole('button', { name: '설정 요약 펼치기', exact: true }).click();
  await page.reload(); await expect(summary).toBeVisible();
  await enableSummary(page); await expect(summary).toHaveCount(0);
  await page.reload(); await expect(summary).toHaveCount(0);
});

// Catches omitted defaults, incorrect active frame ratio and a summary that silently edits settings.
test('overview groups all values, includes defaults on demand and navigates without stacked dialogs', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await studio.getByRole('button', { name: '즉석 정사각', exact: true }).click();
  await studio.getByRole('tab', { name: '효과', exact: true }).click();
  await studio.getByRole('button', { name: '색상만', exact: true }).click();
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await enableSummary(page);
  await page.getByRole('region', { name: '설정 요약', exact: true }).getByRole('button', { name: '전체 설정 보기', exact: true }).click();
  const overview = page.getByRole('dialog', { name: '현재 설정', exact: true });
  await expect(overview).toContainText('1:1'); await expect(overview).toContainText('즉석사진');
  for (const name of ['촬영', '프레임', '필름', '질감', '보정', '뷰티', '날짜 · 보관']) await expect(overview.locator('summary').filter({ hasText: new RegExp(`^${name}`) })).toBeVisible();
  await overview.getByLabel('기본값도 표시', { exact: true }).check();
  await overview.locator('summary').filter({ hasText: /^보정/ }).click();
  const adjustment = overview.locator('summary').filter({ hasText: /^보정/ }).locator('..');
  await expect(adjustment.locator('dt')).toHaveCount(16);
  await overview.locator('summary').filter({ hasText: /^뷰티/ }).click();
  const beauty = overview.locator('summary').filter({ hasText: /^뷰티/ }).locator('..');
  await expect(beauty.locator('dt')).toHaveCount(13);
  await overview.locator('summary').filter({ hasText: /^질감/ }).click();
  await overview.getByRole('button', { name: '효과 설정 열기', exact: true }).click();
  await expect(overview).toHaveCount(0); await expect(studio).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(studio.getByRole('tab', { name: '효과', exact: true })).toHaveAttribute('aria-selected', 'true');
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText('1:1');
});

test('inspection cannot bypass the effect lock after the first booth cut', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'스튜디오',exact:true}).click();
  const studio=page.getByRole('dialog',{name:'스튜디오',exact:true}); await studio.getByRole('tab',{name:'촬영 모드',exact:true}).click(); await studio.getByRole('button',{name:'네 컷',exact:true}).click(); await studio.getByRole('button',{name:'수동',exact:true}).click(); await studio.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'촬영',exact:true}).click(); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await page.getByRole('button',{name:'메뉴',exact:true}).click(); await page.locator('.menu').getByRole('button',{name:'전체 설정 보기',exact:true}).click();
  const overview=page.getByRole('dialog',{name:'현재 설정',exact:true}); await expect(overview.getByRole('button',{name:'필름 선택 열기',exact:true})).toBeDisabled();
  await overview.locator('summary').filter({hasText:/^보정/}).click(); await expect(overview.getByRole('button',{name:'보정 설정 열기',exact:true})).toBeDisabled();
  await overview.locator('summary').filter({hasText:/^뷰티/}).click(); await expect(overview.getByRole('button',{name:'뷰티 설정 열기',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
});

test('composite reprocessing inspection cannot open unsupported beauty controls', async ({ page }) => {
  await page.goto('/'); await page.evaluate(async () => {
    const load=(path:string)=>import(/* @vite-ignore */ path); const {DEFAULT_PARAMS}=await load('/src/engine/types.ts'); const {DEFAULT_BEAUTY}=await load('/src/components/BeautyPanel.tsx'); const {saveCapture}=await load('/src/capture/store.ts');
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=96; canvas.getContext('2d')!.fillRect(0,0,96,96); const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!)));
    await saveCapture({id:'inspect-half',createdAt:1,name:'half.jpg',blob,width:192,height:96,mode:'half',originals:[blob,blob],settings:{lutId:'none',intensity:1,params:DEFAULT_PARAMS,beauty:DEFAULT_BEAUTY,ratioIdx:0,grainOff:false,strengthMode:'color',gentle:false,lens:'none',lensAmount:.5,date:{mode:'off',fmt:'yy',size:'sm',orient:'auto',style:'red'}}});
  });
  await page.reload(); await page.getByRole('button',{name:'최근 촬영 열기',exact:true}).click(); await page.locator('.history-photo').first().click(); await page.getByRole('button',{name:'다시 현상',exact:true}).click();
  await page.getByRole('button',{name:'메뉴',exact:true}).click(); await page.locator('.menu').getByRole('button',{name:'전체 설정 보기',exact:true}).click();
  const overview=page.getByRole('dialog',{name:'현재 설정',exact:true}); await overview.locator('summary').filter({hasText:/^뷰티/}).click(); await expect(overview.getByRole('button',{name:'뷰티 설정 열기',exact:true})).toBeDisabled();
});

test('inspection never reports capability minimum as an actual zoom without track readback', async ({ page }) => {
  await page.addInitScript(() => {
    const capabilities=MediaStreamTrack.prototype.getCapabilities, settings=MediaStreamTrack.prototype.getSettings;
    MediaStreamTrack.prototype.getCapabilities=function(){return {...capabilities.call(this),zoom:{min:.5,max:5,step:.1}};};
    MediaStreamTrack.prototype.getSettings=function(){const result=settings.call(this); delete (result as MediaTrackSettings & {zoom?:number}).zoom; return result;};
  });
  await page.goto('/'); await expect(page.getByRole('button',{name:'촬영',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'메뉴',exact:true}).click(); await page.locator('.menu').getByRole('button',{name:'전체 설정 보기',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'현재 설정',exact:true}).locator('dt').filter({hasText:/^웹 줌$/}).locator('..').locator('dd')).toHaveText('미사용 / 지원 정보 없음');
});

test('auto folding a focused summary moves focus to its full-settings launcher', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/'); await page.getByRole('button',{name:'스튜디오',exact:true}).click();
  const studio=page.getByRole('dialog',{name:'스튜디오',exact:true}); await studio.getByRole('tab',{name:'촬영 모드',exact:true}).click(); await studio.getByRole('button',{name:'네 컷',exact:true}).click(); await studio.getByRole('button',{name:'수동',exact:true}).click(); await studio.getByRole('button',{name:'닫기',exact:true}).click();
  await enableSummary(page); const summary=page.getByRole('region',{name:'설정 요약',exact:true}); await summary.getByRole('button',{name:'전체 설정 보기',exact:true}).focus();
  await page.setViewportSize({width:320,height:568}); await expect(summary.getByRole('button',{name:'설정 요약 전체 보기',exact:true})).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('dialog',{name:'현재 설정',exact:true})).toBeVisible();
});

test('summary storage failures remain usable and escape closes only the settings sheet', async ({ page }) => {
  await page.addInitScript(() => { const get = Storage.prototype.getItem; Storage.prototype.getItem = function(key) { if (key === 'oc-settings-summary') throw new Error('denied'); return get.call(this, key); }; const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'oc-settings-summary') throw new Error('denied'); set.call(this, key, value); }; });
  await page.goto('/'); await enableSummary(page);
  const summary = page.getByRole('region', { name: '설정 요약', exact: true });
  await summary.getByRole('button', { name: '전체 설정 보기', exact: true }).click();
  const overview = page.getByRole('dialog', { name: '현재 설정', exact: true });
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('.settings-overview-dialog'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(overview).toHaveCount(0);
  await expect(summary).toBeVisible(); await expect(summary.getByRole('button', { name: '전체 설정 보기', exact: true })).toBeFocused();
});

test('summary distinguishes configured gentle and auto date from effects not currently applied', async ({ page }) => {
  await page.goto('/'); await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts'); const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx');
    localStorage.setItem('oc-recipes', JSON.stringify([{version:1,id:'inspect',name:'inspect',settings:{lutId:'none',intensity:.7,params:{...DEFAULT_PARAMS,exposure:.25},beauty:{...DEFAULT_BEAUTY,skin:.4},ratioIdx:2,grainOff:true,strengthMode:'whole',gentle:true,lens:'star',lensAmount:.3,date:{mode:'auto',fmt:'yy',size:'sm',orient:'auto',style:'red'}}}]));
  });
  await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '카메라 레시피', exact: true }).click(); await page.getByRole('button', { name: 'inspect 적용', exact: true }).click();
  await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '전체 설정 보기', exact: true }).click();
  const overview = page.getByRole('dialog', { name: '현재 설정', exact: true });
  await expect(overview).toContainText('현재 필터 미지원');
  await overview.locator('summary').filter({ hasText: /^날짜 · 보관/ }).click(); await expect(overview).toContainText('자동 · 현재 꺼짐');
  await overview.locator('summary').filter({ hasText: /^보정/ }).click(); await expect(overview).toContainText('+0.25 EV');
  await overview.locator('summary').filter({ hasText: /^뷰티/ }).click(); await expect(overview).toContainText('40%');
});
