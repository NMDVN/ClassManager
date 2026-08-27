import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Check if Mistral API key is configured on server
  app.get("/api/mistral/status", (_req, res) => {
    res.json({
      hasEnvApiKey: Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.trim() !== ""),
    });
  });

  // OCR and Offence Records Extraction Endpoint (port from Python)
  app.post("/api/mistral/extract-offence-records", async (req, res) => {
    try {
      const { apiKey: userApiKey, imageBase64 } = req.body;
      const apiKey = userApiKey || process.env.MISTRAL_API_KEY;

      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({
          error: "Thiếu Mistral API Key. Vui lòng nhập API Key hoặc cấu hình MISTRAL_API_KEY.",
        });
      }

      if (!imageBase64) {
        return res.status(400).json({ error: "Không tìm thấy dữ liệu ảnh." });
      }

      // 1. Upload File to Mistral API for OCR
      const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      let buffer: Buffer;
      let mimeType = "image/jpeg";
      if (match) {
        mimeType = match[1];
        buffer = Buffer.from(match[2], "base64");
      } else {
        buffer = Buffer.from(imageBase64, "base64");
      }

      const fileFormData = new FormData();
      const fileBlob = new Blob([buffer], { type: mimeType });
      fileFormData.append("file", fileBlob, "offence_log.jpg");
      fileFormData.append("purpose", "ocr");

      const fileRes = await fetch("https://api.mistral.ai/v1/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        body: fileFormData,
      });

      if (!fileRes.ok) {
        const errText = await fileRes.text();
        return res.status(fileRes.status).json({
          error: `Lỗi upload ảnh lên Mistral API (${fileRes.status}): ${errText}`,
        });
      }

      const fileData = await fileRes.json();
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
        return res.status(ocrRes.status).json({
          error: `Lỗi xử lý OCR (${ocrRes.status}): ${errText}`,
        });
      }

      const ocrData = await ocrRes.json();
      let ocrMarkdown = "";
      if (ocrData.pages && Array.isArray(ocrData.pages)) {
        ocrMarkdown = ocrData.pages.map((p: { markdown?: string }) => p.markdown || "").join("\n\n");
      }

      // 3. System Instructions and Schema exact from Python script
      const systemInstructions = `Bạn là bộ phân tích cấu trúc dữ liệu ghi chép.

Input là một bảng markdown được tạo từ OCR.

Nhiệm vụ duy nhất:
- Đọc bảng OCR.
- Xác định từng ghi chép hành vi riêng biệt.
- Tách mỗi ghi chép thành các trường dữ liệu.
- Giữ nguyên thông tin cần thiết từ OCR.

Mục tiêu là trích xuất dữ liệu, không phải sửa hay diễn giải.

Không được:
- sửa lỗi OCR.
- chuẩn hóa tên học sinh.
- chuẩn hóa hành vi.
- thay thế nội dung OCR bằng nội dung trong danh sách tham khảo.
- tự tạo thông tin không xuất hiện trong OCR.
- suy luận quá mức khi không có bằng chứng.

Một ghi chép thường có dạng:
[Tên học sinh] [Hành vi] [Thời gian/ngữ cảnh]

Nhưng:
- OCR có thể sai ký tự.
- Có thể thiếu dấu cách.
- Một ô có thể chứa nhiều ghi chép liên tiếp.
- Một ghi chép có thể không đầy đủ.
- Thứ tự các phần có thể thay đổi.

Các trường cần tách:

1. raw_student:
- Phần có khả năng là tên học sinh trong OCR.
- Giữ nguyên cách viết trong OCR.
- Không sửa thành tên đầy đủ.
- Không dùng danh sách học sinh để thay thế.

2. raw_offence:
- Phần có khả năng là nội dung hành vi trong OCR.
- Giữ nguyên cách ghi trong OCR.
- Có thể chứa viết tắt.
- Không mở rộng viết tắt.
- Không chuyển đổi sang dạng chuẩn.

Ví dụ:
MTT giữ nguyên là "MTT".
KĐKĐ giữ nguyên là "KĐKĐ".

Các thông tin phụ không phải bản thân hành vi thì loại bỏ.

Ví dụ:
- "đi học muộn 10'": raw_offence = "đi học muộn"
- "VLM 5'": raw_offence = "VLM"
- "KĐKĐ 3 lần": raw_offence = "KĐKĐ"

3. raw_time:
- Phần thể hiện tiết học, buổi truy bài, thời điểm hoặc ký hiệu thời gian xuất hiện trong OCR.
- Không giới hạn bởi một danh sách cố định.
- Có thể là viết tắt hoặc viết đầy đủ.
- Chỉ lấy khi có dấu hiệu rõ ràng đó là thông tin thời gian/ngữ cảnh.

Ví dụ có thể gồm:
- T1, T2, T3, T4, T5
- TB
- "truy bài"
- các ký hiệu thời gian khác xuất hiện trong OCR

Không đưa các thông tin về thời lượng vào raw_time.

Ví dụ:
"10'", "5'", "10 phút" là thời lượng, không phải raw_time.

Ví dụ:
Input:
Đạt đi học muộn 10' T3

Output:
raw_student: "Đạt"
raw_offence: "đi học muộn"
raw_time: "T3"

4. date:
- Lấy ngày tương ứng từ bảng OCR.

5. session:
- Lấy đúng buổi sáng hoặc buổi chiều từ cột tương ứng.

6. week:
- Lấy nếu nhìn thấy trong header.

Quy tắc tách record:
- Mỗi ghi chép là một record riêng.
- Không gộp các record giống nhau.
- Không bỏ qua record dù OCR lỗi.
- Không tự hợp nhất hai tên gần giống nhau.

Nếu không chắc chắn một trường:
- trả về null.
- không đoán.

Danh sách họ tên học sinh:
(chỉ dùng để tham khảo nhận diện, tuyệt đối không dùng để sửa OCR)
Chu Minh Anh
Hoàng Trang Anh
Nguyễn Nhật Anh
Nguyễn Tú Anh
Phan Vũ Châu Anh
Trần Vũ Mai Anh
Hoàng Minh Châu
Nguyễn Ngọc Minh Châu
Phạm Thùy Dương
Vũ Đăng Dương
Phạm Hoàng Đạt
Cấn Quang Đức
Hoàng Minh Đức
Nguyễn Minh Đức
Trương Thị Vân Giang
Phùng Thu Hà
Đỗ Mạnh Hải
Nguyễn Minh Hải
Đặng Gia Huy
Lưu Quang Khánh
Trần Huy Anh Khôi
Vũ Thành Khôi
Nguyễn Hương Lan
Nguyễn Phạm Tuyết Lan
Nguyễn Thanh Loan
Trần Hải Long
Đào Quang Minh
Nguyễn Đình Minh
Nguyễn Khánh Minh
Nguyễn Tiến Gia Minh
Lê Trà My
Nguyễn Khánh Nam
Nguyễn Phương Nam
Nguyễn Thu Ngân
Trương Tuấn Nghĩa
Nguyễn Ánh Ngọc
Nguyễn Bảo Ngọc
Nguyễn Khánh Ngọc
Lê Hồng Nhung
Lê Trang Nhung
Phạm Mạnh Quân
Ngô Phương Thảo
Lương Ngọc Mai Thy
Phạm Hoàng Yến Trang
Hoàng Bảo Trâm
Tống Phạm Bảo Trâm
Trần Minh Trí
Nguyễn Phú Trọng
Nguyễn Cẩm Tú
Lương Mạnh Tùng
Phạm Phương Vy
Nguyễn Hoàng Yến

Danh sách hành vi:
(chỉ dùng để hiểu ngữ cảnh, tuyệt đối không chuẩn hóa output)
| Nội dung | Viết tắt | Ghi chú |
| Không đeo khăn quàng đỏ | KĐKĐ | Ghi tối đa 5 lần/tiết nếu lặp lại nhiều lần cởi |
| Mất trật tự | MTT | Tính cả nói tự do |
| Ra khỏi chỗ tự do | RKC | Tính sau tối đa 2 phút sau trống |
| Đổi chỗ | ĐC | |
| Đi học muộn | | Ghi rõ số phút (tương đối) |
| Vào lớp muộn | VLM | Ghi rõ số phút (tương đối) |
| Mặc sai đồng phục | | Ghi rõ trang phục mặc sai |
| Không làm BTVN | | |
| Không trực nhật | | |
| Ngủ trong giờ | | Gục xuống / nằm sàn quá 1 phút |
| Đi chân đất | | Không tính nếu chỉ tháo tại chỗ |
| Xả rác bừa bãi | | |
| Trốn tiết | | Chi ghi khi GV đã xác nhận |
| Mang quà vật lên lớp | | |
| Chơi bài trong lớp | | Ghi rõ tất cả người chơi |
| Cãi nhau, đánh nhau | | Ghi rõ tất cả người tham gia |
| Ghi lỗi SĐB, SNK | | |
| Nói bậy, chửi tục trong giờ | | |
| Chưa nghiêm túc trong giờ chào cờ | | |
| Giơ tay xung phong phát biểu | | Chỉ tính chủ động giơ tay |
| Tham gia vào các hoạt động của lớp | | |
| Được khen ở SĐB/SNK | | |

Chỉ trả về JSON đúng schema.
Không giải thích.
Không thêm văn bản ngoài JSON.`;

      const schema = {
        type: "object",
        required: ["re"],
        properties: {
          re: {
            type: "array",
            items: {
              type: "object",
              required: ["d", "o", "s", "t", "b", "w"],
              properties: {
                b: {
                  enum: ["Buổi sáng", "Buổi chiều", null],
                  type: ["string", "null"],
                  description: "Cột chứa ghi chép",
                },
                d: {
                  type: ["string", "null"],
                  description: "Ngày từ dòng bảng, ví dụ 5/9",
                },
                o: {
                  type: ["string", "null"],
                  description: "Hành vi giữ nguyên từ OCR",
                },
                s: {
                  type: ["string", "null"],
                  description: "Tên học sinh giữ nguyên từ OCR",
                },
                t: {
                  type: ["string", "null"],
                  description: "Tiết hoặc thời gian giữ nguyên từ OCR",
                },
                w: {
                  type: ["integer", "null"],
                  description: "Tuần học nếu có trong header",
                },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      };

      const chatRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "codestral-latest",
          temperature: 0,
          messages: [
            {
              role: "system",
              content: systemInstructions,
            },
            {
              role: "user",
              content: ocrMarkdown,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response_schema",
              schema: schema,
            },
          },
        }),
      });

      if (!chatRes.ok) {
        const errText = await chatRes.text();
        return res.status(chatRes.status).json({
          error: `Lỗi AI Chat Completion (${chatRes.status}): ${errText}`,
        });
      }

      const chatData = await chatRes.json();
      const choiceContent = chatData.choices?.[0]?.message?.content;
      let jsonString = "";
      if (typeof choiceContent === "string") {
        jsonString = choiceContent;
      } else if (Array.isArray(choiceContent)) {
        jsonString = choiceContent.map((c: { text?: string }) => c.text || "").join("");
      }

      jsonString = jsonString.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsedResult = JSON.parse(jsonString);

      return res.json({
        success: true,
        ocrMarkdown,
        records: parsedResult.re || [],
      });
    } catch (error: unknown) {
      const errObj = error as { message?: string };
      console.error("Mistral Extract Offence Records Error:", error);
      return res.status(500).json({
        error: errObj.message || "Lỗi khi trích xuất bản ghi vi phạm từ ảnh.",
      });
    }
  });

  // OCR and Timetable Processing endpoint
  app.post("/api/mistral/process-image", async (req, res) => {
    try {
      const { apiKey: userApiKey, imageBase64, promptMapping } = req.body;
      const apiKey = userApiKey || process.env.MISTRAL_API_KEY;

      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({
          error: "Thiếu Mistral API Key. Vui lòng nhập API Key hoặc cấu hình biến MISTRAL_API_KEY trong cài đặt.",
        });
      }

      if (!imageBase64) {
        return res.status(400).json({ error: "Không tìm thấy dữ liệu ảnh." });
      }

      // 1. Upload File to Mistral API
      const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      let buffer: Buffer;
      let mimeType = "image/jpeg";
      if (match) {
        mimeType = match[1];
        buffer = Buffer.from(match[2], "base64");
      } else {
        buffer = Buffer.from(imageBase64, "base64");
      }

      const fileFormData = new FormData();
      const fileBlob = new Blob([buffer], { type: mimeType });
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
        return res.status(fileRes.status).json({
          error: `Lỗi upload ảnh lên Mistral API (${fileRes.status}): ${errText}`,
        });
      }

      const fileData = await fileRes.json();
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
        return res.status(ocrRes.status).json({
          error: `Lỗi xử lý OCR (${ocrRes.status}): ${errText}`,
        });
      }

      const ocrData = await ocrRes.json();
      let ocrMarkdown = "";
      if (ocrData.pages && Array.isArray(ocrData.pages)) {
        ocrMarkdown = ocrData.pages.map((p: { markdown?: string }) => p.markdown || "").join("\n");
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

${promptMapping || ""}

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
        return res.status(chatRes.status).json({
          error: `Lỗi AI Chat Completion (${chatRes.status}): ${errText}`,
        });
      }

      const chatData = await chatRes.json();
      const choiceContent = chatData.choices?.[0]?.message?.content;
      let jsonString = "";
      if (typeof choiceContent === "string") {
        jsonString = choiceContent;
      } else if (Array.isArray(choiceContent)) {
        jsonString = choiceContent
          .map((c: { text?: string }) => c.text || "")
          .join("");
      }

      jsonString = jsonString.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsedResult = JSON.parse(jsonString);

      return res.json({
        success: true,
        ocrMarkdown,
        timetableJson: parsedResult,
      });
    } catch (error: unknown) {
      const errObj = error as { message?: string };
      console.error("Mistral OCR processing error:", error);
      return res.status(500).json({
        error: errObj.message || "Đã xảy ra lỗi trong quá trình xử lý ảnh bằng Mistral AI.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
