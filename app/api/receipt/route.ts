const MODEL = "gemini-3.5-flash-lite";

const PROMPT = `이 영수증 이미지에서 다음을 읽어 JSON으로 답해.
- amount: 최종 결제 합계 금액(원, 정수). 부가세, 공급가액, 받은 돈, 거스름돈이 아니라 실제로 결제한 총액.
- date: 결제 날짜 (YYYY-MM-DD)
- place: 사용처(상호명)
읽을 수 없거나 확실하지 않은 항목은 null로 둬. 추측하지 마.`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({ error: "GEMINI_API_KEY가 설정되지 않았어요. .env 파일에 키를 넣어주세요." }, { status: 500 });
  }

  const { image, mimeType } = await req.json();
  if (!image) return Response.json({ error: "이미지가 없어요." }, { status: 400 });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType: mimeType || "image/jpeg", data: image } }, { text: PROMPT }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            amount: { type: "INTEGER", nullable: true },
            date: { type: "STRING", nullable: true },
            place: { type: "STRING", nullable: true },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: `Gemini 호출에 실패했어요 (${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    const r = JSON.parse(text);
    return Response.json({
      amount: Number.isInteger(r.amount) && r.amount > 0 ? r.amount : null,
      date: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
      place: typeof r.place === "string" && r.place.trim() ? r.place.trim() : null,
    });
  } catch {
    return Response.json({ error: "영수증을 읽지 못했어요." }, { status: 502 });
  }
}
