import { NextResponse } from "next/server";
import recipesData from "@/src/data/products.json";

export const runtime = "nodejs";

// ─── Types ────────────────────────────────────────────────────────────────────
type Recipe = {
  id: string;
  name: string;
  tags: string[];
  ingredients: string[];
  steps: string[];
};

type RecipeAnswer = {
  name: string;
  ingredients: string[];
  steps: string[];
};

type ApiResponse = {
  transcript?: string;
  answer?: RecipeAnswer;
  error?: string;
  source?: "local" | "n8n";
};

// ─── Load from JSON ───────────────────────────────────────────────────────────
const recipes: Recipe[] = recipesData as Recipe[];

// ─── Keyword Matching (Local) ─────────────────────────────────────────────────
function findRecipeLocal(text: string): RecipeAnswer | null {
  const t = text.toLowerCase();
  const found = recipes.find((r) => {
    if (t.includes(r.name.toLowerCase())) return true;
    return r.tags.some((tag) => t.includes(tag.toLowerCase()));
  });
  if (!found) return null;
  return { name: found.name, ingredients: found.ingredients, steps: found.steps };
}

// ─── Parse n8n Response → RecipeAnswer ───────────────────────────────────────
// n8n ส่งกลับมาได้หลายรูปแบบ รองรับทั้งหมด
function parseN8nResponse(data: any): RecipeAnswer | null {
  // รูปแบบ 1: { answer: { name, ingredients, steps } }
  if (data?.answer?.name) return data.answer as RecipeAnswer;

  // รูปแบบ 2: { name, ingredients, steps } โดยตรง
  if (data?.name && data?.steps) {
    return {
      name: data.name,
      ingredients: data.ingredients ?? [],
      steps: Array.isArray(data.steps) ? data.steps : [data.steps],
    };
  }

  // รูปแบบ 3: { output: "ข้อความ" } หรือ { answer: "ข้อความ" } (plain text)
  const rawText: string | undefined = data?.output || data?.answer || data?.text || data?.result;
  if (typeof rawText === "string" && rawText.trim()) {
    return {
      name: "จาก AI",
      ingredients: [],
      steps: rawText
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  return null;
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await req.json().catch(() => ({}));
    const transcript: string = (body?.text || "").trim();

    if (!transcript) {
      return NextResponse.json(
        { error: "ไม่มีข้อความจากการพูด กรุณาพูดชื่ออาหาร" },
        { status: 400 }
      );
    }

    // ── Step 1: หาใน Local JSON ก่อน ─────────────────────────────────────────
    const localRecipe = findRecipeLocal(transcript);
    if (localRecipe) {
      return NextResponse.json({ transcript, answer: localRecipe, source: "local" });
    }

    // ── Step 2: Fallback → ส่งไป n8n ─────────────────────────────────────────
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nUrl) {
      const menuList = recipes.map((r) => r.name).join(", ");
      return NextResponse.json(
        {
          transcript,
          error: `ขออภัย ยังไม่มีสูตร "${transcript}" ในระบบ ลองพูดชื่อเมนูเหล่านี้: ${menuList}`,
        },
        { status: 200 }
      );
    }

    // เรียก n8n webhook
    const n8nResp = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,        // ข้อความที่ผู้ใช้พูด
        language: "th",    // ภาษา
        context: "cooking", // บอก n8n ว่าเป็น use-case อะไร
        knownMenus: recipes.map((r) => r.name), // รายชื่อเมนูที่มีอยู่แล้ว
      }),
    });

    if (!n8nResp.ok) {
      return NextResponse.json(
        { transcript, error: `n8n ตอบกลับด้วย status ${n8nResp.status}` },
        { status: 502 }
      );
    }

    const n8nData = await n8nResp.json().catch(() => ({}));
    const n8nRecipe = parseN8nResponse(n8nData);

    if (n8nRecipe) {
      return NextResponse.json({ transcript, answer: n8nRecipe, source: "n8n" });
    }

    // n8n ตอบกลับมาแต่ parse ไม่ได้
    return NextResponse.json(
      { transcript, error: n8nData?.error || "n8n ไม่สามารถหาสูตรอาหารนี้ได้" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[voice/route] error:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
