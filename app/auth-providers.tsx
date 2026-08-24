import type {ReactNode} from 'react'

/**
 * The starter leaves authentication UI to the deployer. Server-side route and
 * operator guards stay fail-closed until the configured identity provider has
 * established a session.
 */
export function AuthProviders({children}: {children: ReactNode}): ReactNode {
  return children
}
