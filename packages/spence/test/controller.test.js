const _ = require("lodash/fp");
const initController = require("../src/rest/controller");
const { create, getAll, getById, del, update } = require("../src/rest/rest-handlers");
const { createSchema, dropSchema } = require("../src/tables/schemas");
const knex = require("../src/knex");
const { clearTableRegistry } = require("../src/table-effects/table-registry");
const initFastify = require("./helpers/fastify");
const { NUMERIC_FORMAT, ISO_DATETIME_FORMAT } = require("./helpers/regexes");

const newSimpleSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "new-simple",
  type: "object",
  properties: {
    aVal: {
      type: "string",
    },
    manyVals: {
      type: "array",
      items: {
        type: "string",
      },
      defaults: [],
    },
  },
  required: ["aVal"],
  additionalProperties: false,
};

const simpleSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "simple",
  type: "object",
  allOf: ["immutable-entity#", "new-simple#"],
  required: ["id", "createdAt", "aVal"],
};

describe("controller", () => {
  let schemaName = null;
  let simpleController = null;
  let fastify = null;

  beforeAll(async () => {
    // eslint-disable-next-line global-require
    const { exampleTableCreator, examplesTableEffectsFactory } = require("./test-tables");

    schemaName = `simpleTest--${Date.now()}`;
    await createSchema({
      schemaName,
      tableCreators: [exampleTableCreator(false)],
    });
    (await examplesTableEffectsFactory({ schemaName, transformCase: false }))();

    simpleController = initController(
      {
        tag: "examples",
        schemas: { create: newSimpleSchema, reply: simpleSchema },
        tableName: "examples",
      },
      (router, controllerOptions, next) => {
        router.restRoutes(create, getAll, getById, update, del);
        next();
      }
    );

    fastify = initFastify({ "/examples": simpleController }, {});
  });

  beforeEach(async () => {
    await knex(`${schemaName}.examples`).truncate();
  });

  afterAll(async () => {
    await fastify.close();
    clearTableRegistry();
    await dropSchema({ schemaName });
    knex.destroy();
  });

  it("create simples", async () => {
    const response = await fastify.injectJson({
      method: "POST",
      url: "/examples",
      payload: {
        aVal: "test",
      },
    });
    expect(response.json).toEqual({
      id: expect.stringMatching(NUMERIC_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      aVal: "test",
    });
  });

  it("find simples", async () => {
    const createResponse = await fastify.injectJson({
      method: "POST",
      url: "/examples",
      payload: {
        aVal: "test",
      },
    });

    const findResponse = await fastify.injectJson({
      method: "GET",
      url: `/examples/${createResponse.json.id}`,
    });

    expect(findResponse.json).toEqual({
      id: expect.stringMatching(NUMERIC_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      aVal: "test",
    });
  });

  it("find all simples", async () => {
    const createResponses = _.map(
      "json",
      await Promise.all([
        fastify.injectJson({
          method: "POST",
          url: "/examples",
          payload: {
            aVal: "test",
          },
        }),
        fastify.injectJson({
          method: "POST",
          url: "/examples",
          payload: {
            aVal: "toast",
          },
        }),
      ])
    );
    const findResponse = await fastify.injectJson({ method: "GET", url: `/examples` });
    expect(findResponse.json).toEqual([createResponses[1], createResponses[0]]);
  });

  it("update simples", async () => {
    const createResponses = _.map(
      "json",
      await Promise.all([
        fastify.injectJson({
          method: "POST",
          url: "/examples",
          payload: {
            aVal: "test",
          },
        }),
      ])
    );
    const updateResponse = await fastify.injectJson({
      method: "PATCH",
      url: `/examples/${createResponses[0].id}`,
      payload: { aVal: "not-test" },
    });
    expect(updateResponse.json).toEqual({ ...createResponses[0], aVal: "not-test" });
  });

  it("del simples", async () => {
    const createResponses = _.map(
      "json",
      await Promise.all([
        fastify.injectJson({
          method: "POST",
          url: "/examples",
          payload: {
            aVal: "test",
          },
        }),
      ])
    );
    const delResponse = await fastify.injectJson({ method: "DELETE", url: `/examples/${createResponses[0].id}` });
    expect(delResponse.statusCode).toEqual(204);
    const findResponse = await fastify.injectJson({ method: "GET", url: `/examples` });
    expect(findResponse.json).toEqual([]);
  });

  describe("extensions", () => {
    it("should be possible to add an extension and it works", () => {});
    it("should be possible to add an extension that sets a transaction", () => {});
  });
});
