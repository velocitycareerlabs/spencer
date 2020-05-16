const _ = require("lodash/fp");

const knex = require("../knex");

async function buildColumnInfoFromDb(table, ignoreColumns) {
  const rawColumnInfo = await table().columnInfo();
  return _.fromPairs(
    _.flow(
      _.reject((columnName) => ignoreColumns.includes(columnName)),
      _.map((columnName) => [columnName, rawColumnInfo[columnName].type])
    )(_.keys(rawColumnInfo))
  );
}

function init({ name, schemaName = "public", entityName, ignoreColumns = [], transformCase }, ready) {
  function tableFn(context = {}) {
    const knexTable = connection(context)(name);
    return schemaName ? knexTable.withSchema(schemaName) : knexTable;
  }

  // eslint-disable-next-line no-underscore-dangle
  let _columnInfo;
  buildColumnInfoFromDb(tableFn, ignoreColumns)
    .then((result) => {
      _columnInfo = result;
      ready();
    })
    .catch(ready);

  function connection(context) {
    return (context && context.trx) || knex;
  }

  const table = Object.assign(tableFn, {
    schemaName,
    tableName: name,
    entityName,
    knex,
    connection,
    transformCase,
  });
  Object.defineProperty(table, "columnInfo", {
    get() {
      if (_columnInfo == null) {
        throw new Error("Table not initialized yet. Wait for the ready() signal");
      }
      return _columnInfo;
    },
  });

  Object.defineProperty(table, "columnNames", {
    get() {
      if (_columnInfo == null) {
        throw new Error("Table not initialized yet. Wait for the ready() signal");
      }
      return _.keys(_columnInfo);
    },
  });

  return table;
}

module.exports = init;