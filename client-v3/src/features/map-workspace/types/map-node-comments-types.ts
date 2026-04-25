export type MapNodeCommentMention = {
  displayName: string
  userId: string
}

export type MapNodeComment = {
  authorId: string
  authorName: string
  body: string
  createdAt: string
  id: string
  mentions: MapNodeCommentMention[]
}

export type MapNodeCommentThread = {
  comments: MapNodeComment[]
  isResolved: boolean
  resolvedAt: string | null
  resolvedById: string | null
  resolvedByName: string | null
}

export type MapNodeCommentThreads = Record<string, MapNodeCommentThread>
