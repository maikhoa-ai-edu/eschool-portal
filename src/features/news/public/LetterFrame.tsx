/** Họa tiết cho kiểu trình bày "Thư tri ân": vẽ bằng SVG để không phải tải ảnh. */

const GOLD = '#c9a45c'
const ROSE = '#d9818f'
const LEAF = '#7f9c6b'

/** Một góc khung: hai đường viền cong, một bông hoa và vài chiếc lá. Ba góc còn lại lật từ góc này. */
function Corner({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 90 90"
      className={`pointer-events-none absolute h-14 w-14 sm:h-20 sm:w-20 ${className}`}
      aria-hidden
    >
      <path d="M6 84V26Q6 6 26 6h58" fill="none" stroke={GOLD} strokeWidth="2" />
      <path d="M14 78V30Q14 14 30 14h48" fill="none" stroke={GOLD} strokeWidth="1" opacity="0.7" />
      <g transform="translate(24 24)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            cx="0"
            cy="-7"
            rx="4.2"
            ry="7"
            fill={ROSE}
            opacity="0.85"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r="3.4" fill={GOLD} />
      </g>
      <ellipse cx="46" cy="14" rx="7" ry="3" fill={LEAF} transform="rotate(-18 46 14)" />
      <ellipse cx="14" cy="46" rx="3" ry="7" fill={LEAF} transform="rotate(-18 14 46)" />
      <circle cx="60" cy="14" r="2" fill={GOLD} />
      <circle cx="14" cy="60" r="2" fill={GOLD} />
    </svg>
  )
}

export function LetterCorners() {
  return (
    <>
      <Corner className="left-1.5 top-1.5" />
      <Corner className="right-1.5 top-1.5 -scale-x-100" />
      <Corner className="bottom-1.5 left-1.5 -scale-y-100" />
      <Corner className="bottom-1.5 right-1.5 -scale-100" />
    </>
  )
}

/** Biểu tượng đầu thư: quyển sách mở, cây bút và nhành hoa. */
export function LetterEmblem() {
  return (
    <svg viewBox="0 0 120 56" className="mx-auto mb-2 h-12 w-28" aria-hidden>
      <path d="M60 46C48 38 30 36 14 38V12c16-2 34 0 46 8z" fill="#fff" stroke={GOLD} strokeWidth="2" />
      <path d="M60 46c12-8 30-10 46-8V12c-16-2-34 0-46 8z" fill="#fff" stroke={GOLD} strokeWidth="2" />
      <path d="M60 20v26" stroke={GOLD} strokeWidth="2" />
      <path
        d="M22 20c8-1 18 0 28 4M22 27c8-1 18 0 28 4M70 24c10-4 20-5 28-4M70 31c10-4 20-5 28-4"
        stroke={GOLD}
        strokeWidth="1"
        opacity="0.6"
        fill="none"
      />
      <path d="M86 6l10 30" stroke="#7a2331" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M96 36l-1.4 5-2.6-4.4z" fill="#7a2331" />
      <g transform="translate(38 8)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} cx="0" cy="-4" rx="2.6" ry="4.2" fill={ROSE} transform={`rotate(${deg})`} />
        ))}
        <circle r="2" fill={GOLD} />
      </g>
    </svg>
  )
}

/** Dòng ký tên cuối thư: tên học sinh và lớp. */
export function LetterSignature({ name, schoolClass }: { name: string; schoolClass?: string | null }) {
  return (
    <div className="mt-8 flex justify-end">
      <div className="min-w-48 text-center font-letter">
        <svg viewBox="0 0 160 14" className="mx-auto mb-1 h-3 w-40" aria-hidden>
          <path d="M2 7c26-8 52 8 78 0s52-8 78 0" fill="none" stroke={GOLD} strokeWidth="1.5" />
        </svg>
        <p className="text-lg font-bold italic text-[#7a2331]">{name}</p>
        {schoolClass && <p className="text-sm text-[#6b5a45]">Lớp {schoolClass}</p>}
      </div>
    </div>
  )
}
