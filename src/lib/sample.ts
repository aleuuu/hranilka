/** Рисует демо-скриншот «оплата в приложении банка» — его модель описывает на шаге «Вот что я вижу».
 *  Банк вымышленный, никаких реальных брендов. */
export async function makeSampleImage(): Promise<{ dataUrl: string; b64: string }> {
  try { await document.fonts.ready; } catch { /* шрифты не критичны */ }
  const W = 540, H = 960;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  const font = (w: number, px: number) => `${w} ${px}px Onest, system-ui, sans-serif`;
  const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

  g.fillStyle = "#f3f4f6"; g.fillRect(0, 0, W, H);
  // статус-бар
  g.fillStyle = "#111"; g.font = font(600, 24); g.fillText("14:12", 32, 46);
  g.textAlign = "right"; g.fillText("82%", W - 32, 46); g.textAlign = "left";
  // шапка
  g.fillStyle = "#111"; g.font = font(500, 30); g.fillText("‹  Мой банк", 28, 118);
  // карточка
  g.fillStyle = "#fff"; rr(24, 156, W - 48, 612, 28); g.fill();
  g.fillStyle = "#22c55e"; g.beginPath(); g.arc(W / 2, 250, 52, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(W / 2 - 22, 252); g.lineTo(W / 2 - 4, 270); g.lineTo(W / 2 + 26, 236); g.stroke();
  g.textAlign = "center";
  g.fillStyle = "#6b7280"; g.font = font(400, 26); g.fillText("Платёж выполнен", W / 2, 350);
  g.fillStyle = "#111"; g.font = font(600, 64); g.fillText("4 800 ₽", W / 2, 430);
  g.textAlign = "left";
  const rows: [string, string][] = [
    ["Получатель", "ООО «Термоленд»"],
    ["Назначение", "Оплата посещения"],
    ["Дата", "23 августа 2026, 14:12"],
    ["Счёт списания", "Карта •• 4821"],
    ["Комиссия", "0 ₽"],
  ];
  rows.forEach(([k, v], i) => {
    const y = 500 + i * 52;
    g.fillStyle = "#9ca3af"; g.font = font(400, 22); g.fillText(k, 56, y);
    g.fillStyle = "#111"; g.font = font(500, 22); g.textAlign = "right"; g.fillText(v, W - 56, y); g.textAlign = "left";
    if (i < rows.length - 1) { g.fillStyle = "#f0f1f3"; g.fillRect(56, y + 20, W - 112, 2); }
  });
  // кнопки
  g.fillStyle = "#111"; rr(24, 800, W - 48, 76, 20); g.fill();
  g.fillStyle = "#fff"; g.font = font(500, 26); g.textAlign = "center"; g.fillText("Сохранить чек", W / 2, 848);
  g.fillStyle = "#6b7280"; g.font = font(400, 22); g.fillText("Повторить платёж", W / 2, 920);

  const dataUrl = cv.toDataURL("image/jpeg", 0.9);
  return { dataUrl, b64: dataUrl.split(",")[1] };
}
