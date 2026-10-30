/** Hỏi lại trước thao tác không hoàn tác được. */
export function confirmAction(message: string): boolean {
  return window.confirm(message)
}
