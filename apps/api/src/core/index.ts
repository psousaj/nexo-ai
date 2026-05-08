// Contracts
export { toIntakeEnvelope } from './contracts/intake-envelope';
export type { IntakeEnvelope } from './contracts/intake-envelope';
export type { ObservationEnvelope } from './contracts/observation-envelope';
export { HermesRuntimeError } from './contracts/runtime-error';

// Registries
export type { SessionRegistry } from './registries/session-registry';
export type { MemoryRegistry } from './registries/memory-registry';
export { PostgresMemoryRegistry } from './registries/memory-registry';
export type { HermesToolRegistry } from './registries/tool-registry';
export { PostgresToolRegistry } from './registries/tool-registry';

// Runtime
export { createHermesRuntime } from './runtime/hermes-runtime';
export type { HermesRuntime } from './runtime/hermes-runtime';

// Kernel
export { HermesKernel } from './kernel/hermes-kernel';
export type { ModelTurnRunner, ModelTurnOutput } from './kernel/model-turn-runner';
export { executeToolWithPolicy } from './kernel/tool-executor';

// Model
export { DefaultModelTurnRunner, CredentialPool } from './model';
export { getTransport, detectApiMode } from './model/transports';
export type { NormalizedResponse, ApiMode } from './model/transports/types';

// Policies
export type { ToolPolicy, HermesToolDescriptor } from './policies/policy-types';
export { toUserSafeFailureResponse } from './policies/failure-strategy';

// Gateway
export { IngestionGateway } from './gateway/ingestion-gateway';
export type { CanonicalMessageEnvelope, IngestMessageQueuePayload, IngestionResult } from './gateway/ingestion-gateway';
export { AttachmentIntakeService } from './gateway/attachment-intake';
export type { Attachment, ProcessedAttachment } from './gateway/attachment-intake';
export { OutgoingGateway } from './gateway/outgoing-gateway';
export type { DispatchPayload } from './gateway/outgoing-gateway';

// Memory
export { SemanticWrapperPipeline } from './memory/semantic-wrapper-pipeline';
export { PostgresProjectionStore } from './memory/projection-store';
export { applyRelevanceDecay } from './memory/relevance-decay';

// Context
export { ContextAssembler } from './context/context-assembler';

// Jobs
export { runSelfImprovementReview } from './jobs/self-improvement-review.job';
export { runProactiveRefresh } from './jobs/proactive-refresh.job';

// Observability
export { writeTurnAudit, buildUserFacingReason } from './observability/turn-audit';

// Testing
export { ShadowReplayRunner } from './testing/shadow-replay';
export type { ReplayComparisonResult } from './testing/shadow-replay';
