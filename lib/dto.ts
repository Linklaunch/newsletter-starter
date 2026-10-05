import type {IssueRow, PromoRecord} from '../journalist/runs-log'
import type {IssueDetailDto} from './editor-actions'

/** Client-safe DTOs deliberately omit provider identifiers and provider URLs. */
export type OperatorIssueDto = Omit<IssueRow, 'broadcastId' | 'dashboardUrl'>
export type OperatorPromoDto = Omit<PromoRecord, 'broadcastId' | 'dashboardUrl'>
export type OperatorIssueDetailDto = Omit<IssueDetailDto, 'issue'> & {
  issue: OperatorIssueDto
}

/**
 * What an anonymous visitor may see about an issue.
 *
 * Built by naming the fields to include rather than by removing fields from the
 * row. That way a column added to `newsletter_issues` later cannot leak into
 * the public API by accident - it simply will not appear until someone adds it
 * here on purpose.
 */
export interface PublicIssueDto {
  slug: string
  issueNumber: number
  subject: string
  intro: string
  publishedAt: number
  publicationId: string
}

/** As above, plus the rendered body. Only ever built from a sent issue. */
export interface PublicIssueDetailDto extends PublicIssueDto {
  bodyHtml: string
}

export function toPublicIssueDto(issue: IssueRow): PublicIssueDto {
  return {
    slug: issue.slug,
    issueNumber: issue.issueNumber,
    subject: issue.subject,
    intro: issue.intro,
    publishedAt: issue.createdAt,
    publicationId: issue.publicationId
  }
}

/**
 * Returns null when the issue has no rendered body, so a half-built record can
 * never be served as a readable issue.
 */
export function toPublicIssueDetailDto(
  issue: IssueRow
): PublicIssueDetailDto | null {
  if (!issue.bodyHtml) return null
  return {...toPublicIssueDto(issue), bodyHtml: issue.bodyHtml}
}

export function toOperatorIssueDto(issue: IssueRow): OperatorIssueDto {
  const {
    broadcastId: _broadcastId,
    dashboardUrl: _dashboardUrl,
    ...safe
  } = issue
  return safe
}

export function toOperatorPromoDto(promo: PromoRecord): OperatorPromoDto {
  const {
    broadcastId: _broadcastId,
    dashboardUrl: _dashboardUrl,
    ...safe
  } = promo
  return safe
}

export function toOperatorIssueDetailDto(
  detail: IssueDetailDto
): OperatorIssueDetailDto {
  return {...detail, issue: toOperatorIssueDto(detail.issue)}
}

export type {IssueStatus, SectionDraftRow} from '../journalist/runs-log'
export type {
  ScheduleResultDto,
  SectionDraftDto,
  SendResultDto
} from './editor-actions'
