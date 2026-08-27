interface Env {
  MISTRAL_API_KEY?: string;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const body: { apiKey?: string; imageBase64?: string; promptMapping?: string } =
      await context.request.json();
    const apiKey = body.apiKey || context.env.MISTRAL_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          error: "Thiếu Mistral API Key. Vui lòng nhập API Key hoặc cấu hình MISTRAL_API_KEY.",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.imageBase64) {
      return new Response(
        JSON.stringify({ error: "Không tìm thấy dữ liệu ảnh." }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Upload File to Mistral API
    const match = body.imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    let bytes: Uint8Array;
    let mimeType = "image/jpeg";
    if (match) {
      mimeType = match[1];
      bytes = base64ToUint8Array(match[2]);
    } else {
      bytes = base64ToUint8Array(body.imageBase64);
    }

    const fileFormData = new FormData();
    const fileBlob = new Blob([bytes], { type: mimeType });
    fileFormData.append("file", fileBlob, "timetable.jpg");
    fileFormData.append("purpose", "ocr");

    const fileRes = await fetch("https://api.mistral.ai/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: fileFormData,
    });

    if (!fileRes.ok) {
      const errText = await fileRes.text();
      return new Response(
        JSON.stringify({
          error: `Lỗi upload ảnh lên Mistral API (${fileRes.status}): ${errText}`,
        }),
        {
          status: fileRes.status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const fileData = (await fileRes.json()) as { id: string };
    const fileId = fileData.id;

    // 2. Run OCR on document
    const ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "file",
          file_id: fileId,
        },
        include_image_base64: false,
      }),
    });

    if (!ocrRes.ok) {
      const errText = await ocrRes.text();
      return new Response(
        JSON.stringify({
          error: `Lỗi xử lý OCR (${ocrRes.status}): ${errText}`,
        }),
        {
          status: ocrRes.status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const ocrData = (await ocrRes.json()) as { pages?: Array<{ markdown?: string }> };
    let ocrMarkdown = "";
    if (ocrData.pages && Array.isArray(ocrData.pages)) {
      ocrMarkdown = ocrData.pages.map((p) => p.markdown || "").join("\n");
    }

    // 3. Schema definition matching the required output
    const schema = {
      type: "object",
      properties: {
        "2": {
          type: "array",
          description: "Monday. Exactly 9 subject IDs. Elements 1-5 are morning periods. Elements 6-9 are afternoon periods. Use 0 if there is no class.",
          items: { type: "integer" },
          minItems: 9,
          maxItems: 9,
        },
        "3": {
          type: "array",
          description: "Tuesday. Same format as Monday.",
          items: { type: "integer" },
          minItems: 9,
          maxItems: 9,
        },
        "4": {
          type: "array",
          description: "Wednesday. Same format as Monday.",
          items: { type: "integer" },
          minItems: 9,
          maxItems: 9,
        },
        "5": {
          type: "array",
          description: "Thursday. Same format as Monday.",
          items: { type: "integer" },
          minItems: 9,
          maxItems: 9,
        },
        "6": {
          type: "array",
          description: "Friday. Same format as Monday.",
          items: { type: "integer" },
          minItems: 9,
          maxItems: 9,
        },
      },
      required: ["2", "3", "4", "5", "6"],
    };

    const systemUserPrompt = `Hãy đọc chính xác thời khóa biểu và trả về JSON theo schema.

Quy ước:
- Key "2" đến "6" tương ứng Thứ 2 đến Thứ 6.
- Mỗi mảng phải có đúng 9 phần tử.
- Phần tử 1-5 là 5 tiết buổi sáng.
- Phần tử 6-9 là 4 tiết buổi chiều.
- Giá trị là subject_id theo bảng ánh xạ được cung cấp.
- Chỉ trả về JSON hợp lệ, không giải thích.

${body.promptMapping || ""}

Bảng Thời Khóa Biểu:
${ocrMarkdown}`;

    const chatRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: systemUserPrompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "timetable",
            schema: schema,
          },
        },
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      return new Response(
        JSON.stringify({
          error: `Lỗi AI Chat Completion (${chatRes.status}): ${errText}`,
        }),
        {
          status: chatRes.status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const chatData = (await chatRes.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };
    const choiceContent = chatData.choices?.[0]?.message?.content;
    let jsonString = "";
    if (typeof choiceContent === "string") {
      jsonString = choiceContent;
    } else if (Array.isArray(choiceContent)) {
      jsonString = choiceContent
        .map((c) => c.text || "")
        .join("");
    }

    jsonString = jsonString.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsedResult = JSON.parse(jsonString);

    return new Response(
      JSON.stringify({
        success: true,
        ocrMarkdown,
        timetableJson: parsedResult,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errObj = error as { message?: string };
    return new Response(
      JSON.stringify({
        error: errObj.message || "Đã xảy ra lỗi trong quá trình xử lý ảnh bằng Mistral AI.",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
};
