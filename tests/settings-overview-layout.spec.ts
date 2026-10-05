import { expect, test } from '@playwright/test';

for (const [name, width, height] of [['small',320,568],['mobile',390,844],['landscape',844,390],['desktop',1280,800]] as const) {
  test(`Studio and overview preserve reachable actions and summary avoids the composite at ${name}`, async ({ page }) => {
    await page.setViewportSize({width,height}); await page.goto('/');
    await page.getByRole('button', {name:'스튜디오',exact:true}).click();
    const studio = page.getByRole('dialog',{name:'스튜디오',exact:true});
    await studio.getByRole('tab',{name:'효과',exact:true}).click();
    await expect(studio.getByRole('button',{name:'원본 · 필름 없음',exact:true})).toBeVisible();
    expect(await studio.getByRole('tab',{name:'효과',exact:true}).evaluate(el=>getComputedStyle(el).boxShadow)).toBe('none');
    await expect(studio.getByRole('tab',{name:'효과',exact:true})).toHaveAttribute('aria-selected','true');
    await page.screenshot({path:`.impeccable/review/studio-refined-${name}.png`, animations:'disabled'});
    await studio.getByRole('tab',{name:'촬영 모드',exact:true}).click();
    await studio.getByRole('button',{name:'네 컷',exact:true}).click(); await studio.getByRole('button',{name:'수동',exact:true}).click(); await studio.getByRole('button',{name:'닫기',exact:true}).click();
    await page.getByRole('button',{name:'메뉴',exact:true}).click(); await page.getByRole('switch',{name:'설정 요약 표시',exact:true}).click();
    const summary = page.getByRole('region',{name:'설정 요약',exact:true});
    const overlap = async () => { const a=(await summary.boundingBox())!, b=(await page.locator('.capture-preview').boundingBox())!; return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)); };
    await expect.poll(overlap).toBe(0);
    await page.getByRole('button',{name:'합성 미리보기 확대',exact:true}).click(); await expect.poll(overlap).toBe(0);
    await page.getByRole('button',{name:'합성 미리보기 축소',exact:true}).click(); await expect.poll(overlap).toBe(0);
    const box=(await summary.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThanOrEqual(height);
    expect(box.y+box.height).toBeLessThanOrEqual((await page.locator('.strip').boundingBox())!.y);
    await page.screenshot({path:`.impeccable/review/settings-summary-${name}.png`});
    // A constrained window may auto-fold; the menu remains a direct inspection entry.
    await page.getByRole('button',{name:'메뉴',exact:true}).click(); await page.locator('.menu').getByRole('button',{name:'전체 설정 보기',exact:true}).click();
    const overview=page.getByRole('dialog',{name:'현재 설정',exact:true});
    expect(await overview.evaluate(el=>el.scrollWidth <= el.clientWidth+1)).toBe(true);
    await overview.getByLabel('기본값도 표시',{exact:true}).check();
    await page.screenshot({path:`.impeccable/review/settings-overview-${name}.png`});
    const head=await overview.getByRole('button',{name:'닫기',exact:true}).boundingBox();
    await overview.locator('.settings-overview-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    expect(await overview.getByRole('button',{name:'닫기',exact:true}).boundingBox()).toEqual(head);
    await page.keyboard.press('Escape'); await expect(overview).toHaveCount(0);
  });
}
