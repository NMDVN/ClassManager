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
    const body: { apiKey?: string; imageBase64?: string } = await context.request.json();
    const apiKey = body.apiKey || context.env.MISTRAL_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          error: "Thiếu Mistral API Key. Vui lòng nhập API Key hoặc cấu hình MISTRAL_API_KEY trên Cloudflare Pages Settings.",
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

    // 1. Upload File to Mistral API for OCR
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
    fileFormData.append("file", fileBlob, "offence_log.jpg");
    fileFormData.append("purpose", "ocr");

    const fileRes = await fetch("https://api.mistral.ai/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
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
      ocrMarkdown = ocrData.pages.map((p) => p.markdown || "").join("\n\n");
    }

    // 3. System Instructions and Schema
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
      jsonString = choiceContent.map((c) => c.text || "").join("");
    }

    jsonString = jsonString.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsedResult = JSON.parse(jsonString) as { re?: unknown[] };

    return new Response(
      JSON.stringify({
        success: true,
        ocrMarkdown,
        records: parsedResult.re || [],
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
        error: errObj.message || "Lỗi khi trích xuất bản ghi vi phạm từ ảnh.",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
};
