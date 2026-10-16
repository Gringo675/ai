import { parseDocument, DomUtils } from 'htmlparser2'
import type { Element } from 'domhandler'

export interface ValidationResult {
  verdict: 'PASS' | 'FAIL'
  reason?: string
}

export interface DocumentInfo {
  docNumber: string
  docName?: string
  docType?: 'stnd' | 'rstr'
  fileLink?: string | null
  year?: number
}

/**
 * Валидатор HTML-разметки технических характеристик товара.
 * Проверяет:
 * 1. Синтаксическую валидность HTML (парность тегов, корректность разметки, отсутствие markdown).
 * 2. Правила верстки (отсутствие caption и inline-стилей, наличие thead/tbody, scope="col", классы ta-start/ta-end).
 * 3. Порядок документов и корректность ссылок на нормативные файлы.
 */
export function validateProductCharacteristicsHtml(
  html: string,
  documents: DocumentInfo[] = [],
): ValidationResult {
  if (!html || typeof html !== 'string' || !html.trim()) {
    return {
      verdict: 'FAIL',
      reason: 'Сгенерированный HTML-блок характеристик пуст',
    }
  }

  // 1. Проверка на Markdown-разметку
  if (html.includes('```') || /\|[-:]+\|/.test(html)) {
    return {
      verdict: 'FAIL',
      reason: 'Обнаружена Markdown-разметка (``` или таблицы |---|). Требуется чистый валидный HTML',
    }
  }

  // 2. Проверка на запрещенные теги и атрибуты
  if (/<caption[\s>]/i.test(html)) {
    return {
      verdict: 'FAIL',
      reason: 'Обнаружен запрещенный тег <caption>. Заголовки блоков оформляются абзацем <p><strong>...</strong></p> перед таблицей',
    }
  }

  if (/style\s*=/i.test(html)) {
    return {
      verdict: 'FAIL',
      reason: 'Обнаружены запрещенные inline-стили (style="..."). Для выравнивания используйте исключительно классы ta-start, ta-end, ta-center',
    }
  }

  // 3. Синтаксическая валидность: проверка баланса и парности тегов
  const requiredTags = ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'p', 'strong', 'a', 'ul', 'ol', 'li']
  for (const tag of requiredTags) {
    const openRegex = new RegExp(`<${tag}(\\s+[^>]*)?>`, 'gi')
    const closeRegex = new RegExp(`</${tag}\\s*>`, 'gi')
    const openCount = (html.match(openRegex) || []).length
    const closeCount = (html.match(closeRegex) || []).length
    if (openCount !== closeCount) {
      return {
        verdict: 'FAIL',
        reason: `Нарушен синтаксис HTML: нарушен баланс тегов <${tag}> (открыто ${openCount}, закрыто ${closeCount}). Проверьте закрытие всех тегов`,
      }
    }
  }

  // 4. Парсинг структуры через htmlparser2
  const dom = parseDocument(html, { lowerCaseTags: true })

  // Проверка таблиц (если они есть)
  const tables = DomUtils.getElementsByTagName('table', dom) as Element[]
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    const tableIndex = i + 1

    const theads = DomUtils.getElementsByTagName('thead', table) as Element[]
    const tbodies = DomUtils.getElementsByTagName('tbody', table) as Element[]

    if (theads.length === 0) {
      return {
        verdict: 'FAIL',
        reason: `В таблице №${tableIndex} отсутствует обязательный тег <thead>`,
      }
    }

    if (tbodies.length === 0) {
      return {
        verdict: 'FAIL',
        reason: `В таблице №${tableIndex} отсутствует обязательный тег <tbody>`,
      }
    }

    // Проверка ячеек шапки <th>
    const ths = DomUtils.getElementsByTagName('th', theads[0]) as Element[]
    if (ths.length === 0) {
      return {
        verdict: 'FAIL',
        reason: `В таблице №${tableIndex} в блоке <thead> отсутствуют ячейки шапки <th>`,
      }
    }

    for (const th of ths) {
      const scope = th.attribs?.scope
      if (!scope || scope !== 'col') {
        return {
          verdict: 'FAIL',
          reason: `В таблице №${tableIndex} у ячейки <th> отсутствует обязательный атрибут scope="col"`,
        }
      }
    }

    // Проверка классов выравнивания у всех ячеек таблицы
    const tds = DomUtils.getElementsByTagName('td', table) as Element[]
    const allCells = [...ths, ...tds]
    for (const cell of allCells) {
      const cls = cell.attribs?.class || ''
      const hasAlignment = cls.includes('ta-start') || cls.includes('ta-end') || cls.includes('ta-center')
      if (!hasAlignment) {
        return {
          verdict: 'FAIL',
          reason: `В таблице №${tableIndex} ячейка <${cell.name}> не содержит обязательного класса выравнивания (ta-start, ta-end или ta-center)`,
        }
      }
    }
  }

  // 5. Проверка порядка документов и целостности ссылок
  if (documents && documents.length > 0) {
    let lastFoundIndex = -1

    for (const doc of documents) {
      if (!doc.docNumber) continue

      // Ищем упоминание номера документа в тексте
      // Например "ГОСТ 166-89" или "96750-25"
      const cleanDocNumber = doc.docNumber.replace(/^№\s*/, '').trim()
      const searchPattern = new RegExp(cleanDocNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      const match = searchPattern.exec(html)

      if (match) {
        if (match.index < lastFoundIndex) {
          return {
            verdict: 'FAIL',
            reason: `Нарушен порядок следования документов: блок "${doc.docNumber}" расположен раньше предшествующего документа`,
          }
        }
        lastFoundIndex = match.index

        // Если к документу привязан файл, проверяем наличие корректной ссылки
        if (doc.fileLink) {
          const rawLink = doc.fileLink
          const decodedLink = decodeURI(rawLink)
          const allLinks = DomUtils.getElementsByTagName('a', dom) as Element[]

          const matchingLink = allLinks.find((a) => {
            const href = a.attribs?.href || ''
            return href === rawLink || decodeURI(href) === decodedLink || encodeURI(href) === rawLink
          })

          if (!matchingLink) {
            return {
              verdict: 'FAIL',
              reason: `Для документа "${doc.docNumber}" отсутствует ссылка на файл (ожидался href="${doc.fileLink}")`,
            }
          }

          const linkClass = matchingLink.attribs?.class || ''
          if (!linkClass.includes('doc-viewer-link')) {
            return {
              verdict: 'FAIL',
              reason: `Ссылка на файл для документа "${doc.docNumber}" не содержит обязательный класс class="doc-viewer-link"`,
            }
          }

          if (matchingLink.attribs?.target !== '_blank') {
            return {
              verdict: 'FAIL',
              reason: `Ссылка на файл для документа "${doc.docNumber}" обязана содержать атрибут target="_blank"`,
            }
          }
        }
      }
    }
  }

  return { verdict: 'PASS' }
}
