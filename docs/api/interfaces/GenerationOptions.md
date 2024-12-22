[@ai16z/eliza v0.1.4-alpha.3](../index.md) / GenerationOptions

# Interface: GenerationOptions

Configuration options for generating objects with a model.

## Properties

### runtime

> **runtime**: [`IAgentRuntime`](IAgentRuntime.md)

#### Defined in

[packages/core/src/generation.ts:1044](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1044)

***

### context

> **context**: `string`

#### Defined in

[packages/core/src/generation.ts:1045](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1045)

***

### modelClass

> **modelClass**: [`ModelClass`](../enumerations/ModelClass.md)

#### Defined in

[packages/core/src/generation.ts:1046](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1046)

***

### schema?

> `optional` **schema**: `ZodType`\<`any`, `ZodTypeDef`, `any`\>

#### Defined in

[packages/core/src/generation.ts:1047](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1047)

***

### schemaName?

> `optional` **schemaName**: `string`

#### Defined in

[packages/core/src/generation.ts:1048](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1048)

***

### schemaDescription?

> `optional` **schemaDescription**: `string`

#### Defined in

[packages/core/src/generation.ts:1049](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1049)

***

### stop?

> `optional` **stop**: `string`[]

#### Defined in

[packages/core/src/generation.ts:1050](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1050)

***

### mode?

> `optional` **mode**: `"auto"` \| `"json"` \| `"tool"`

#### Defined in

[packages/core/src/generation.ts:1051](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1051)

***

### experimental\_providerMetadata?

> `optional` **experimental\_providerMetadata**: `Record`\<`string`, `unknown`\>

#### Defined in

[packages/core/src/generation.ts:1052](https://github.com/christroutner/eliza/blob/main/packages/core/src/generation.ts#L1052)
