import type { XYPosition } from "reactflow"

import type {
  BuiltInBranchStarter,
  BuiltInMapTemplate,
  MapSeedGraph,
} from "@/features/maps/types/maps-types"
import type {
  MapEditorEdge,
  MapEditorNode,
} from "@/features/map-editor/types/map-editor-types"

const MAP_NODE_STYLE = {
  border: "1.5px solid hsl(var(--border))",
  borderRadius: 14,
  boxShadow: "0 10px 18px hsl(var(--foreground) / 0.08)",
  padding: 0,
}

const STARTER_BASE_X_OFFSET = 340
const STARTER_CHILDREN_X_GAP = 320
const STARTER_VERTICAL_GAP = 160

function createPresetNode(params: {
  color: MapEditorNode["data"]["color"]
  description?: string
  id: string
  kind: MapEditorNode["data"]["kind"]
  media?: MapEditorNode["data"]["media"]
  position: XYPosition
  title: string
}) {
  return {
    data: {
      ...(params.description ? { description: params.description } : {}),
      ...(params.media ? { media: params.media } : {}),
      color: params.color,
      kind: params.kind,
      title: params.title,
    },
    id: params.id,
    position: params.position,
    style: {
      ...MAP_NODE_STYLE,
    },
    type: "mapNode",
  } satisfies MapEditorNode
}

function createPresetEdge(params: {
  id: string
  label?: string
  link?: string
  note?: string
  source: string
  target: string
}) {
  return {
    ...(params.label ? { label: params.label } : {}),
    data:
      params.link || params.note
        ? {
            ...(params.link ? { link: params.link } : {}),
            ...(params.note ? { note: params.note } : {}),
          }
        : {},
    id: params.id,
    source: params.source,
    target: params.target,
    type: "mapEdge",
  } satisfies MapEditorEdge
}

const builtInMapTemplates = [
  {
    description:
      "Frame a kickoff quickly with goals, scope, delivery shape, and early risk visibility.",
    graph: {
      edges: [
        createPresetEdge({
          id: "kickoff-edge-goal-scope",
          label: "defines",
          source: "kickoff-goal",
          target: "kickoff-scope",
        }),
        createPresetEdge({
          id: "kickoff-edge-goal-stakeholders",
          label: "serves",
          source: "kickoff-goal",
          target: "kickoff-stakeholders",
        }),
        createPresetEdge({
          id: "kickoff-edge-goal-milestones",
          label: "lands in",
          source: "kickoff-goal",
          target: "kickoff-milestones",
        }),
        createPresetEdge({
          id: "kickoff-edge-scope-risks",
          label: "watch",
          note: "Capture uncertainty before execution begins.",
          source: "kickoff-scope",
          target: "kickoff-risks",
        }),
      ],
      nodes: [
        createPresetNode({
          color: "violet",
          description: "What success looks like and why this map exists.",
          id: "kickoff-goal",
          kind: "idea",
          position: { x: 120, y: 220 },
          title: "Project goal",
        }),
        createPresetNode({
          color: "sky",
          description: "In scope, out of scope, and the first delivery slice.",
          id: "kickoff-scope",
          kind: "task",
          position: { x: 430, y: 120 },
          title: "Scope and first slice",
        }),
        createPresetNode({
          color: "emerald",
          description: "Decision makers, users, and collaborators to keep close.",
          id: "kickoff-stakeholders",
          kind: "resource",
          position: { x: 430, y: 260 },
          title: "Stakeholders",
        }),
        createPresetNode({
          color: "amber",
          description: "Milestones, launches, and review dates.",
          id: "kickoff-milestones",
          kind: "decision",
          position: { x: 430, y: 400 },
          title: "Milestones",
        }),
        createPresetNode({
          color: "rose",
          description: "Dependencies, unknowns, and blockers to track early.",
          id: "kickoff-risks",
          kind: "question",
          position: { x: 750, y: 120 },
          title: "Risks and unknowns",
        }),
      ],
    } satisfies MapSeedGraph,
    id: "project-kickoff",
    name: "Project kickoff",
    suggestedDescription:
      "Goals, scope, stakeholders, milestones, and risks for a new initiative.",
    suggestedName: "Project kickoff",
    summary: "Goal, scope, stakeholders, milestones, and risks in one starting map.",
  },
  {
    description:
      "Run a team planning session with clear priorities, owners, blockers, and follow-through.",
    graph: {
      edges: [
        createPresetEdge({
          id: "weekly-edge-focus-must",
          label: "must ship",
          source: "weekly-focus",
          target: "weekly-must",
        }),
        createPresetEdge({
          id: "weekly-edge-focus-support",
          label: "supporting work",
          source: "weekly-focus",
          target: "weekly-support",
        }),
        createPresetEdge({
          id: "weekly-edge-focus-owners",
          label: "owned by",
          source: "weekly-focus",
          target: "weekly-owners",
        }),
        createPresetEdge({
          id: "weekly-edge-focus-risks",
          label: "blocked by",
          source: "weekly-focus",
          target: "weekly-risks",
        }),
      ],
      nodes: [
        createPresetNode({
          color: "violet",
          description: "The single sentence that keeps the week aligned.",
          id: "weekly-focus",
          kind: "idea",
          position: { x: 120, y: 220 },
          title: "Weekly focus",
        }),
        createPresetNode({
          color: "emerald",
          description: "The outcomes that have to move this week.",
          id: "weekly-must",
          kind: "task",
          position: { x: 430, y: 80 },
          title: "Must ship",
        }),
        createPresetNode({
          color: "sky",
          description: "Meetings, reviews, and support work that affect delivery.",
          id: "weekly-support",
          kind: "resource",
          position: { x: 430, y: 220 },
          title: "Supporting work",
        }),
        createPresetNode({
          color: "amber",
          description: "People responsible for the outcomes above.",
          id: "weekly-owners",
          kind: "decision",
          position: { x: 430, y: 360 },
          title: "Owners",
        }),
        createPresetNode({
          color: "rose",
          description: "Dependencies and blockers that need active follow-up.",
          id: "weekly-risks",
          kind: "question",
          position: { x: 740, y: 220 },
          title: "Blockers and dependencies",
        }),
      ],
    } satisfies MapSeedGraph,
    id: "weekly-planning",
    name: "Weekly planning",
    suggestedDescription:
      "A simple planning board for priorities, owners, and blockers.",
    suggestedName: "Weekly planning",
    summary: "Weekly focus, must-ship outcomes, owners, and blockers.",
  },
  {
    description:
      "Turn research into a usable synthesis with evidence, patterns, and next questions.",
    graph: {
      edges: [
        createPresetEdge({
          id: "research-edge-question-sources",
          label: "informed by",
          source: "research-question",
          target: "research-sources",
        }),
        createPresetEdge({
          id: "research-edge-question-findings",
          label: "reveals",
          source: "research-question",
          target: "research-findings",
        }),
        createPresetEdge({
          id: "research-edge-findings-insights",
          label: "clusters into",
          source: "research-findings",
          target: "research-insights",
        }),
        createPresetEdge({
          id: "research-edge-insights-next",
          label: "suggests",
          source: "research-insights",
          target: "research-next",
        }),
      ],
      nodes: [
        createPresetNode({
          color: "violet",
          description: "The question the research needs to answer.",
          id: "research-question",
          kind: "question",
          position: { x: 120, y: 220 },
          title: "Research question",
        }),
        createPresetNode({
          color: "slate",
          description: "Interviews, docs, tickets, or datasets feeding this map.",
          id: "research-sources",
          kind: "resource",
          position: { x: 430, y: 80 },
          title: "Sources",
        }),
        createPresetNode({
          color: "sky",
          description: "Observations, quotes, or behaviors worth preserving.",
          id: "research-findings",
          kind: "idea",
          position: { x: 430, y: 220 },
          title: "Key findings",
        }),
        createPresetNode({
          color: "emerald",
          description: "Themes, insights, or decisions emerging from the findings.",
          id: "research-insights",
          kind: "decision",
          position: { x: 740, y: 220 },
          title: "Insights and themes",
        }),
        createPresetNode({
          color: "amber",
          description: "The next experiments, follow-ups, or open questions.",
          id: "research-next",
          kind: "task",
          position: { x: 1050, y: 220 },
          title: "Next questions",
        }),
      ],
    } satisfies MapSeedGraph,
    id: "research-synthesis",
    name: "Research synthesis",
    suggestedDescription:
      "Organize evidence, findings, themes, and next questions from research work.",
    suggestedName: "Research synthesis",
    summary: "Evidence, findings, insights, and next questions for research work.",
  },
] satisfies BuiltInMapTemplate[]

const builtInBranchStarters = [
  {
    description:
      "Expand a node into an explicit decision branch with options, tradeoffs, and a recommendation.",
    graph: {
      edges: [
        createPresetEdge({
          id: "decision-edge-root-options",
          label: "options",
          source: "decision-root",
          target: "decision-options",
        }),
        createPresetEdge({
          id: "decision-edge-root-tradeoffs",
          label: "tradeoffs",
          source: "decision-root",
          target: "decision-tradeoffs",
        }),
        createPresetEdge({
          id: "decision-edge-root-recommendation",
          label: "recommend",
          source: "decision-root",
          target: "decision-recommendation",
        }),
      ],
      nodes: [
        createPresetNode({
          color: "amber",
          description: "Define the decision you need to make.",
          id: "decision-root",
          kind: "decision",
          position: { x: 0, y: 0 },
          title: "Decision point",
        }),
        createPresetNode({
          color: "sky",
          description: "List the realistic paths forward.",
          id: "decision-options",
          kind: "idea",
          position: { x: 320, y: -120 },
          title: "Options",
        }),
        createPresetNode({
          color: "rose",
          description: "Capture what each option costs or complicates.",
          id: "decision-tradeoffs",
          kind: "question",
          position: { x: 320, y: 20 },
          title: "Tradeoffs",
        }),
        createPresetNode({
          color: "emerald",
          description: "State the recommendation and why.",
          id: "decision-recommendation",
          kind: "task",
          position: { x: 320, y: 160 },
          title: "Recommendation",
        }),
      ],
    } satisfies MapSeedGraph,
    id: "decision-pack",
    name: "Decision pack",
    rootNodeId: "decision-root",
    summary: "Options, tradeoffs, and recommendation attached to the selected node.",
  },
  {
    description:
      "Turn a topic into an execution branch with concrete work, ownership, and blockers.",
    graph: {
      edges: [
        createPresetEdge({
          id: "execution-edge-root-next",
          label: "next",
          source: "execution-root",
          target: "execution-next",
        }),
        createPresetEdge({
          id: "execution-edge-root-owner",
          label: "owner",
          source: "execution-root",
          target: "execution-owner",
        }),
        createPresetEdge({
          id: "execution-edge-root-blockers",
          label: "watch",
          source: "execution-root",
          target: "execution-blockers",
        }),
      ],
      nodes: [
        createPresetNode({
          color: "emerald",
          description: "Name the workstream or initiative branch.",
          id: "execution-root",
          kind: "task",
          position: { x: 0, y: 0 },
          title: "Workstream",
        }),
        createPresetNode({
          color: "sky",
          description: "The immediate next move to keep momentum.",
          id: "execution-next",
          kind: "task",
          position: { x: 320, y: -120 },
          title: "Next step",
        }),
        createPresetNode({
          color: "amber",
          description: "Who is driving the work.",
          id: "execution-owner",
          kind: "resource",
          position: { x: 320, y: 20 },
          title: "Owner",
        }),
        createPresetNode({
          color: "rose",
          description: "Dependencies, blockers, or open risks.",
          id: "execution-blockers",
          kind: "question",
          position: { x: 320, y: 160 },
          title: "Blockers",
        }),
      ],
    } satisfies MapSeedGraph,
    id: "execution-branch",
    name: "Execution branch",
    rootNodeId: "execution-root",
    summary: "Next step, owner, and blockers for a selected node.",
  },
  {
    description:
      "Break a point into evidence, sources, and open questions without reshaping the whole map.",
    graph: {
      edges: [
        createPresetEdge({
          id: "evidence-edge-root-source",
          label: "backed by",
          source: "evidence-root",
          target: "evidence-source",
        }),
        createPresetEdge({
          id: "evidence-edge-root-insight",
          label: "means",
          source: "evidence-root",
          target: "evidence-insight",
        }),
        createPresetEdge({
          id: "evidence-edge-root-open",
          label: "still asks",
          source: "evidence-root",
          target: "evidence-open",
        }),
      ],
      nodes: [
        createPresetNode({
          color: "sky",
          description: "The evidence cluster connected to the selected node.",
          id: "evidence-root",
          kind: "resource",
          position: { x: 0, y: 0 },
          title: "Evidence cluster",
        }),
        createPresetNode({
          color: "slate",
          description: "Links, notes, interviews, or tickets supporting the point.",
          id: "evidence-source",
          kind: "resource",
          position: { x: 320, y: -120 },
          title: "Source",
        }),
        createPresetNode({
          color: "emerald",
          description: "What the evidence suggests or changes.",
          id: "evidence-insight",
          kind: "idea",
          position: { x: 320, y: 20 },
          title: "Insight",
        }),
        createPresetNode({
          color: "amber",
          description: "What is still unresolved or worth testing next.",
          id: "evidence-open",
          kind: "question",
          position: { x: 320, y: 160 },
          title: "Open question",
        }),
      ],
    } satisfies MapSeedGraph,
    id: "evidence-cluster",
    name: "Evidence cluster",
    rootNodeId: "evidence-root",
    summary: "Source, insight, and open question nodes for a selected topic.",
  },
] satisfies BuiltInBranchStarter[]

function cloneNodeData(node: MapEditorNode) {
  return {
    ...node.data,
    ...(node.data.media ? { media: { ...node.data.media } } : {}),
  }
}

function createRuntimeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function cloneSeedGraph(graph: MapSeedGraph) {
  const nodeIdMap = new Map<string, string>()

  const nodes = graph.nodes.map((node) => {
    const nextId = createRuntimeId("node")
    nodeIdMap.set(node.id, nextId)

    return {
      ...node,
      data: cloneNodeData(node),
      id: nextId,
      position: { ...node.position },
      style: node.style ? { ...node.style } : node.style,
    }
  })

  const edges = graph.edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : edge.data,
    id: createRuntimeId("edge"),
    source: nodeIdMap.get(edge.source) ?? edge.source,
    style: edge.style ? { ...edge.style } : edge.style,
    target: nodeIdMap.get(edge.target) ?? edge.target,
  }))

  return {
    edges,
    nodeIdMap,
    nodes,
  }
}

function findDirectChildren(
  anchorNodeId: string,
  currentNodes: MapEditorNode[],
  currentEdges: MapEditorEdge[]
) {
  const nodesById = new Map(currentNodes.map((node) => [node.id, node]))

  return currentEdges
    .filter((edge) => edge.source === anchorNodeId)
    .map((edge) => nodesById.get(edge.target))
    .filter((node): node is MapEditorNode => Boolean(node))
}

export function getBuiltInMapTemplates() {
  return builtInMapTemplates
}

export function getBuiltInMapTemplate(templateId: string) {
  return builtInMapTemplates.find((template) => template.id === templateId) ?? null
}

export function instantiateMapTemplateGraph(template: BuiltInMapTemplate) {
  const { edges, nodes } = cloneSeedGraph(template.graph)
  return { edges, nodes }
}

export function getBuiltInBranchStarters() {
  return builtInBranchStarters
}

export function instantiateBranchStarterGraph(
  starter: BuiltInBranchStarter,
  params: {
    anchorNodeId: string
    currentEdges: MapEditorEdge[]
    currentNodes: MapEditorNode[]
  }
) {
  const anchorNode = params.currentNodes.find(
    (node) => node.id === params.anchorNodeId
  )
  if (!anchorNode) {
    return null
  }

  const directChildren = findDirectChildren(
    params.anchorNodeId,
    params.currentNodes,
    params.currentEdges
  )
  const nextRootX =
    directChildren.length > 0
      ? Math.max(
          anchorNode.position.x + STARTER_BASE_X_OFFSET,
          ...directChildren.map((node) => node.position.x + STARTER_CHILDREN_X_GAP)
        )
      : anchorNode.position.x + STARTER_BASE_X_OFFSET
  const nextRootY =
    directChildren.length > 0
      ? Math.max(
          anchorNode.position.y,
          ...directChildren.map((node) => node.position.y)
        ) + STARTER_VERTICAL_GAP
      : anchorNode.position.y

  const { edges, nodeIdMap, nodes } = cloneSeedGraph(starter.graph)
  const seedRootNode = starter.graph.nodes.find(
    (node) => node.id === starter.rootNodeId
  )
  const rootNodeId = nodeIdMap.get(starter.rootNodeId)

  if (!seedRootNode || !rootNodeId) {
    return null
  }

  const offsetX = nextRootX - seedRootNode.position.x
  const offsetY = nextRootY - seedRootNode.position.y
  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: Math.round(node.position.x + offsetX),
      y: Math.round(node.position.y + offsetY),
    },
  }))

  return {
    edges: [
      createPresetEdge({
        id: createRuntimeId("edge"),
        source: params.anchorNodeId,
        target: rootNodeId,
      }),
      ...edges,
    ],
    nodes: positionedNodes,
    rootNodeId,
  }
}
