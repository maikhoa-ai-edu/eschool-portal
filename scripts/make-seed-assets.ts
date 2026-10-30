/**
 * Tạo ảnh & văn bản mẫu cho dữ liệu demo (chỉ dùng khi phát triển; kết quả đã nằm sẵn trong repo).
 *
 *   node scripts/make-seed-assets.ts [thư-mục-ảnh-gốc]   (bỏ trống: chỉ tạo lại văn bản PDF)
 *
 * - Ảnh: thu nhỏ/cắt bằng canvas của Chromium (Playwright) rồi lưu JPEG nhẹ.
 * - Văn bản: dựng HTML theo thể thức văn bản hành chính rồi in ra PDF (giữ nguyên dấu tiếng Việt).
 * Kết quả: supabase/seed-storage/<bucket>/seed/... ; scripts/seed-storage.ts tải chúng lên Storage cục bộ.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'supabase', 'seed-storage')
const SOURCE = process.argv[2]

interface ImageJob {
  source: string
  out: string
  width: number
  height: number
  /** Vùng cắt trên ảnh gốc theo tỉ lệ 0..1: [x, y, rộng, cao] */
  crop?: [number, number, number, number]
}

const IMAGES: ImageJob[] = [
  { source: 'logo.jpg', out: 'seed/logo.jpg', width: 400, height: 400 },
  { source: 'school_header_pattern.jpg', out: 'seed/slide-chao-mung.jpg', width: 1376, height: 768 },
  { source: 'education_slide_study.jpg', out: 'seed/slide-hoc-tap.jpg', width: 1376, height: 768 },
  { source: 'education_slide_growth.jpg', out: 'seed/slide-stem.jpg', width: 1376, height: 768 },
  { source: 'banner_ho_chi_minh.jpg', out: 'seed/slide-bac-ho.jpg', width: 1376, height: 768 },
  // Album "Học tập & trải nghiệm": cắt nhiều khung hình từ ảnh lớp học và CLB STEM
  {
    source: 'education_slide_study.jpg',
    out: 'seed/album/hoc-tap-1.jpg',
    width: 960,
    height: 720,
    crop: [0, 0.2, 0.5, 0.8],
  },
  {
    source: 'education_slide_study.jpg',
    out: 'seed/album/hoc-tap-2.jpg',
    width: 960,
    height: 720,
    crop: [0.5, 0.2, 0.5, 0.8],
  },
  {
    source: 'education_slide_growth.jpg',
    out: 'seed/album/stem-1.jpg',
    width: 960,
    height: 720,
    crop: [0.1, 0.25, 0.5, 0.75],
  },
  {
    source: 'education_slide_growth.jpg',
    out: 'seed/album/stem-2.jpg',
    width: 960,
    height: 720,
    crop: [0.45, 0.2, 0.55, 0.8],
  },
  // Album "Khuôn viên & thư viện"
  { source: 'campus_facade.jpg', out: 'seed/album/khuon-vien.jpg', width: 1280, height: 714 },
  { source: 'slogan_banner.jpg', out: 'seed/album/thu-vien.jpg', width: 1280, height: 714 },
  { source: 'education_slide_growth.jpg', out: 'seed/album/san-truong.jpg', width: 1280, height: 714 },
]

const HEADER = (left: string, number: string) => `
  <table class="head"><tr>
    <td><div>SỞ GD&amp;ĐT AN GIANG</div><div class="b">TRƯỜNG THCS &amp; THPT<br>VĨNH PHONG</div><div class="line"></div><div>Số: ${number}</div></td>
    <td><div class="b">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div class="b u">Độc lập - Tự do - Hạnh phúc</div><div class="i">${left}</div></td>
  </tr></table>`

const SIGN = (title: string, name: string) => `
  <table class="sign"><tr><td class="recv"><b><i>Nơi nhận:</i></b><br>- Như trên;<br>- Lưu: VT.</td>
  <td><div class="b">${title}</div><div class="i">(Đã ký)</div><br><br><div class="b">${name}</div></td></tr></table>`

const DOCUMENTS: Array<{ out: string; html: string }> = [
  {
    out: 'seed/ke-hoach-nam-hoc-2026-2027.pdf',
    html: `${HEADER('Vĩnh Phong, ngày 05 tháng 9 năm 2026', '01/KH-THCSTHPTVP')}
      <h1>KẾ HOẠCH<br>Thực hiện nhiệm vụ năm học 2026 - 2027</h1>
      <h2>I. MỤC TIÊU</h2>
      <p>1. Nâng cao chất lượng dạy học theo Chương trình giáo dục phổ thông 2018; tăng cường ứng dụng công nghệ
      thông tin và chuyển đổi số trong quản lý, dạy học.</p>
      <p>2. Duy trì sĩ số, phấn đấu tỉ lệ học sinh lên lớp đạt trên 98%, tốt nghiệp THPT đạt 100%.</p>
      <p>3. Đẩy mạnh hoạt động trải nghiệm, câu lạc bộ STEM, giáo dục kỹ năng sống cho học sinh.</p>
      <h2>II. NHIỆM VỤ VÀ GIẢI PHÁP</h2>
      <p>1. Tổ chức dạy học đúng, đủ chương trình; đổi mới kiểm tra, đánh giá theo hướng phát triển năng lực.</p>
      <p>2. Bồi dưỡng học sinh giỏi, phụ đạo học sinh yếu kém ngay từ đầu năm học.</p>
      <p>3. Xây dựng trường học xanh - sạch - đẹp - an toàn; phối hợp chặt chẽ với cha mẹ học sinh.</p>
      <h2>III. TỔ CHỨC THỰC HIỆN</h2>
      <table class="grid"><tr><th>Thời gian</th><th>Nội dung</th><th>Phụ trách</th></tr>
      <tr><td>Tháng 9/2026</td><td>Khai giảng, ổn định nề nếp, họp cha mẹ học sinh</td><td>BGH, GVCN</td></tr>
      <tr><td>Tháng 10-11/2026</td><td>Hội giảng, kiểm tra giữa học kỳ I</td><td>Tổ chuyên môn</td></tr>
      <tr><td>Tháng 12/2026</td><td>Thi học sinh giỏi cấp trường, kiểm tra cuối học kỳ I</td><td>BGH, Tổ chuyên môn</td></tr>
      <tr><td>Tháng 5/2027</td><td>Tổng kết năm học</td><td>Hội đồng trường</td></tr></table>
      ${SIGN('HIỆU TRƯỞNG', 'Nguyễn Văn An')}`,
  },
  {
    out: 'seed/quyet-dinh-thanh-lap-to-chuyen-mon.pdf',
    html: `${HEADER('Vĩnh Phong, ngày 10 tháng 9 năm 2026', '15/QĐ-THCSTHPTVP')}
      <h1>QUYẾT ĐỊNH<br>Về việc thành lập các tổ chuyên môn năm học 2026 - 2027</h1>
      <p class="c b">HIỆU TRƯỞNG TRƯỜNG THCS &amp; THPT VĨNH PHONG</p>
      <p><i>Căn cứ Điều lệ trường trung học cơ sở, trường trung học phổ thông và trường phổ thông có nhiều cấp học;</i></p>
      <p><i>Xét đề nghị của Phó Hiệu trưởng phụ trách chuyên môn,</i></p>
      <p class="c b">QUYẾT ĐỊNH:</p>
      <p><b>Điều 1.</b> Thành lập 05 tổ chuyên môn: Toán - Tin; Ngữ văn - Ngoại ngữ; Khoa học tự nhiên; Khoa học xã hội;
      Giáo dục thể chất - Nghệ thuật.</p>
      <p><b>Điều 2.</b> Tổ trưởng chuyên môn có nhiệm vụ xây dựng kế hoạch, tổ chức sinh hoạt chuyên môn theo nghiên cứu
      bài học, báo cáo định kỳ với Ban Giám hiệu.</p>
      <p><b>Điều 3.</b> Các ông (bà) có tên trong danh sách kèm theo chịu trách nhiệm thi hành quyết định này.</p>
      ${SIGN('HIỆU TRƯỞNG', 'Nguyễn Văn An')}`,
  },
  {
    out: 'seed/thong-bao-lich-kiem-tra-giua-hoc-ky-1.pdf',
    html: `${HEADER('Vĩnh Phong, ngày 20 tháng 10 năm 2026', '42/TB-THCSTHPTVP')}
      <h1>THÔNG BÁO<br>Lịch kiểm tra giữa học kỳ I năm học 2026 - 2027</h1>
      <p>Nhà trường thông báo lịch kiểm tra giữa học kỳ I đến toàn thể giáo viên, học sinh và cha mẹ học sinh như sau:</p>
      <table class="grid"><tr><th>Ngày</th><th>Buổi sáng</th><th>Buổi chiều</th></tr>
      <tr><td>02/11/2026</td><td>Ngữ văn (90 phút)</td><td>Lịch sử (45 phút)</td></tr>
      <tr><td>03/11/2026</td><td>Toán (90 phút)</td><td>Địa lý (45 phút)</td></tr>
      <tr><td>04/11/2026</td><td>Tiếng Anh (60 phút)</td><td>Khoa học tự nhiên (60 phút)</td></tr></table>
      <p>Học sinh có mặt trước giờ kiểm tra 15 phút, mang theo thẻ học sinh và dụng cụ học tập cần thiết.</p>
      ${SIGN('KT. HIỆU TRƯỞNG<br>PHÓ HIỆU TRƯỞNG', 'Trần Thị Bình')}`,
  },
  {
    out: 'seed/ke-hoach-hoc-tap-lam-theo-bac.pdf',
    html: `${HEADER('Vĩnh Phong, ngày 08 tháng 9 năm 2026', '05/KH-THCSTHPTVP')}
      <h1>KẾ HOẠCH<br>Học tập và làm theo Bác năm học 2026 - 2027</h1>
      <p class="i">(Tài liệu minh họa của dữ liệu mẫu)</p>
      <h2>I. MỤC ĐÍCH</h2>
      <p>Đưa việc học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh thành việc làm thường xuyên của
      cán bộ, giáo viên, nhân viên và học sinh; gắn với nhiệm vụ năm học.</p>
      <h2>II. NỘI DUNG</h2>
      <p>1. Cán bộ, giáo viên đăng ký một việc làm cụ thể, rà soát trong sinh hoạt tổ chuyên môn hằng tháng.</p>
      <p>2. Học sinh thực hiện 5 điều Bác Hồ dạy; các lớp tuyên dương người tốt việc tốt trong tiết sinh hoạt.</p>
      <p>3. Đoàn - Đội tổ chức sinh hoạt chủ điểm, hội thi kể chuyện về Bác.</p>
      <h2>III. LỊCH THỰC HIỆN</h2>
      <table class="grid"><tr><th>Thời gian</th><th>Nội dung</th><th>Phụ trách</th></tr>
      <tr><td>Tháng 9/2026</td><td>Quán triệt kế hoạch, đăng ký việc làm</td><td>Chi bộ, BGH</td></tr>
      <tr><td>Tháng 10/2026</td><td>Hội thi kể chuyện về Bác cấp trường</td><td>Đoàn trường</td></tr>
      <tr><td>Tháng 5/2027</td><td>Tổng kết, tuyên dương</td><td>Chi bộ, BGH</td></tr></table>
      ${SIGN('HIỆU TRƯỞNG', 'Nguyễn Văn An')}`,
  },
  {
    out: 'seed/tai-lieu-5-dieu-bac-ho-day.pdf',
    html: `<h1>TÀI LIỆU SINH HOẠT LỚP<br>5 điều Bác Hồ dạy thiếu niên, nhi đồng</h1>
      <p class="i">(Tài liệu minh họa của dữ liệu mẫu)</p>
      <table class="grid"><tr><th>Điều</th><th>Gợi ý liên hệ hằng ngày</th></tr>
      <tr><td>1. Yêu Tổ quốc, yêu đồng bào</td><td>Nghiêm túc khi chào cờ, giúp đỡ bạn bè và người xung quanh.</td></tr>
      <tr><td>2. Học tập tốt, lao động tốt</td><td>Làm bài đầy đủ, tham gia trực nhật và lao động của lớp.</td></tr>
      <tr><td>3. Đoàn kết tốt, kỷ luật tốt</td><td>Đi học đúng giờ, không gây gổ, cùng nhau làm việc nhóm.</td></tr>
      <tr><td>4. Giữ gìn vệ sinh thật tốt</td><td>Giữ sạch lớp học, sân trường, bỏ rác đúng nơi quy định.</td></tr>
      <tr><td>5. Khiêm tốn, thật thà, dũng cảm</td><td>Nhận lỗi khi làm sai, trả lại của rơi, dám nói điều đúng.</td></tr></table>`,
  },
  {
    out: 'seed/mau-don-xin-nghi-hoc.pdf',
    html: `<div class="c b">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div class="c b u">Độc lập - Tự do - Hạnh phúc</div>
      <h1>ĐƠN XIN NGHỈ HỌC</h1>
      <p>Kính gửi: Giáo viên chủ nhiệm lớp ........ Trường THCS &amp; THPT Vĩnh Phong</p>
      <p>Tôi tên là: ................................................................ là phụ huynh của học sinh:</p>
      <p>Họ và tên học sinh: ........................................................ Lớp: ...............</p>
      <p>Nay tôi làm đơn này xin cho con được nghỉ học ........ ngày, từ ngày ..../..../........ đến ngày ..../..../........</p>
      <p>Lý do: ......................................................................................................................</p>
      <p>Tôi xin cam kết nhắc nhở con chép bài và học bù đầy đủ. Kính mong thầy (cô) chấp thuận.</p>
      <table class="sign"><tr><td></td><td><div class="i">........., ngày .... tháng .... năm ........</div>
      <div class="b">PHỤ HUYNH HỌC SINH</div><div class="i">(Ký và ghi rõ họ tên)</div></td></tr></table>`,
  },
]

const DOC_CSS = `
  @page { size: A4; margin: 15mm 15mm 15mm 25mm; }
  body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; color: #000; }
  .head { width: 100%; text-align: center; font-size: 12pt; margin-bottom: 18px; }
  .head td { vertical-align: top; white-space: nowrap; }
  .head td:first-child { width: 42%; }
  .line { width: 35%; margin: 4px auto; border-top: 1px solid #000; }
  .b { font-weight: bold; } .i { font-style: italic; } .u { text-decoration: underline; } .c { text-align: center; }
  h1 { text-align: center; font-size: 14pt; margin: 18px 0; }
  h2 { font-size: 13pt; margin: 12px 0 4px; }
  p { margin: 4px 0; text-align: justify; }
  .grid { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .grid th, .grid td { border: 1px solid #000; padding: 4px 8px; }
  .sign { width: 100%; margin-top: 16px; page-break-inside: avoid; } .sign td { width: 50%; vertical-align: top; text-align: center; }
  .sign td.recv { text-align: left; font-size: 11pt; }`

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  for (const job of SOURCE ? IMAGES : []) {
    const bytes = readFileSync(join(SOURCE!, job.source))
    const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`
    const out = await page.evaluate(
      async ({ dataUrl, job }) => {
        const img = new Image()
        img.src = dataUrl
        await img.decode()
        const [cx, cy, cw, ch] = job.crop ?? [0, 0, 1, 1]
        const sx = cx * img.width
        const sy = cy * img.height
        let sw = cw * img.width
        let sh = ch * img.height
        // Giữ đúng tỉ lệ khung đích: cắt bớt phần thừa ở giữa vùng chọn
        const target = job.width / job.height
        if (sw / sh > target) sw = sh * target
        else sh = sw / target
        const canvas = document.createElement('canvas')
        canvas.width = job.width
        canvas.height = job.height
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, job.width, job.height)
        return canvas.toDataURL('image/jpeg', 0.74)
      },
      { dataUrl, job },
    )
    const file = join(OUT, 'media', job.out)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(out.split(',')[1]!, 'base64'))
    console.log(`media/${job.out}`, statSync(file).size)
  }

  for (const doc of DOCUMENTS) {
    await page.setContent(
      `<!doctype html><html lang="vi"><meta charset="utf-8"><style>${DOC_CSS}</style><body>${doc.html}</body></html>`,
    )
    const file = join(OUT, 'documents', doc.out)
    mkdirSync(dirname(file), { recursive: true })
    await page.pdf({ path: file, format: 'A4', preferCSSPageSize: true, printBackground: true })
    console.log(`documents/${doc.out}`, statSync(file).size)
  }

  await browser.close()
}

await main()
