import type {IssueRow, PromoRecord} from '../journalist/runs-log'
import type {IssueDetailDto} from './editor-actions'

/** Client-safe DTOs deliberately omit provider identifiers and provider URLs. */
export type OperatorIssueDto = Omit<IssueRow, 'broadcastId' | 'dashboardUrl'>
export type OperatorPromoDto = Omit<PromoRecord, 'broadcastId' | 'dashboardUrl'>
export type OperatorIssueDetailDto = Omit<IssueDetailDto, 'issue'> & {
  issue: OperatorIssueDto
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
