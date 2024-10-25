import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IEntityProvider } from '../types/entity-provider.interface';
import { TKeysOf } from '@onivoro/isomorphic-common';
import { TTableMeta } from '../types/table-meta.type';

export class TypeOrmRepository<TEntity> implements IEntityProvider<
  TEntity,
  FindOneOptions<TEntity>,
  FindManyOptions<TEntity>,
  FindOptionsWhere<TEntity>,
  QueryDeepPartialEntity<TEntity>
> {
  protected columns: TKeysOf<TEntity, TTableMeta> = {} as any;
  protected table: string;
  debug = false;

  constructor(public entityType: any, public entityManager: EntityManager) {

    const { tableName } = this.repo.metadata;

    this.table = tableName;

    this.repo.metadata.columns.forEach((_) => {
      const { databasePath, propertyPath, type, isPrimary } = _;
      this.columns[propertyPath] = { databasePath, type, propertyPath, isPrimary, default: _.default };
    })
  }

  forTransaction(entityManager: EntityManager): TypeOrmRepository<TEntity> {
    return new (this.constructor as typeof TypeOrmRepository<TEntity>)(this.entityType, entityManager);
  }

  async getMany(options: FindManyOptions<TEntity>): Promise<TEntity[]> {
    return await (this.repo.find as any)(options);
  }

  async getManyAndCount(options: FindManyOptions<TEntity>): Promise<[TEntity[], number]> {
    return await (this.repo.findAndCount as any)(options);
  }

  async getOne(options: FindOneOptions<TEntity>): Promise<TEntity> {
    const results = await this.getMany(options);

    if (results?.length > 1) {
      throw new Error(`${TypeOrmRepository.prototype.getOne.name} expects only 1 result but found ${results.length} results of entity type "${this.entityType}" for criteria ${JSON.stringify(options, null, 2)}`);
    }

    return results[0];
  }

  async postOne(body: Partial<TEntity>): Promise<TEntity> {
    return await this.insertAndReturn(body as TEntity);
  }

  async postMany(body: Partial<TEntity>[]): Promise<TEntity[]> {
    return await this.insertAndReturnMany(body as TEntity[]);
  }

  async delete(options: FindOptionsWhere<TEntity>): Promise<void> {
    return await (this.repo.delete as any)(options);
  }

  async softDelete(options: FindOptionsWhere<TEntity>): Promise<void> {
    return await (this.repo.softDelete as any)(options);
  }

  async put(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>) {
    await this.repo.save(options, body);
  }

  async patch(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>) {
    await this.repo.update(options, body);
  }

  get repo() {
    return this.entityManager.getRepository(this.entityType as any);
  }

  protected async insertAndReturn(entityToInsert: TEntity): Promise<TEntity> {
    return (await this.insertAndReturnMany([entityToInsert]))[0];
  }

  protected async insertAndReturnMany(entitiesToInsert: TEntity[]): Promise<TEntity[]> {
    const insertionResult = await this.repo
      .createQueryBuilder()
      .insert()
      .values(entitiesToInsert)
      .returning('*')
      .execute();

    const insertedEntity: TEntity[] =
      insertionResult.generatedMaps as TEntity[];

    return insertedEntity;
  }

  protected buildSelectStatement(options: FindManyOptions<TEntity>): { query: string; queryParams: any[]; } {
    const { whereClause, queryParams } = this.buildWhereExpression(options.where as FindOptionsWhere<TEntity>);
    const query = `SELECT * FROM "${this.table}"${whereClause};`;
    return { query, queryParams };
  }

  protected buildDeleteStatement(where: FindManyOptions<TEntity>): { query: string; queryParams: any[]; } {
    const { whereClause, queryParams } = this.buildWhereExpression(where as FindOptionsWhere<TEntity>);
    const query = `DELETE FROM "${this.table}"${whereClause};`;
    return { query, queryParams };
  }

  protected buildWhereExpression(where?: FindOptionsWhere<TEntity>) {
    const queryParams: any[] = [];
    let whereClause = '';

    Object.entries(where || {}).forEach(([propertyPath, value], index) => {
      const key = this.columns[propertyPath].databasePath;
      if (index === 0) {
        whereClause += ` WHERE ${key} = $${index + 1}`;
      } else {
        whereClause += ` AND ${key} = $${index + 1}`;
      }
      queryParams.push(value);
    });

    return { queryParams, whereClause };
  }

  protected buildInsertQuery(entity: Partial<TEntity>): { insertQuery: string, values: any[] } {
    const keys = Object.keys(entity);
    const values = Object.values(entity);

    const columnNames = keys.map(key => this.columns[key].databasePath).join(', ');
    const paramPlaceholders = keys.map((_, index) => `$${index + 1}`).join(', ');

    const insertQuery = `INSERT INTO "${this.table}" (${columnNames}) VALUES (${paramPlaceholders})`;

    return { insertQuery, values };
  }

  protected buildInsertManyQuery(entities: Partial<TEntity>[]): { insertQuery: string, values: any[] } {
    const keyMap: any = {};

    entities.forEach(entity => {
      Object.keys(entity)
        .forEach(key => {
          keyMap[key] = true;
        });
    });

    const columnNames = Object.keys(keyMap).map(key => this.columns[key].databasePath).join(', ');

    const valuesExpressions: string[] = [];
    const values: any[] = [];

    entities.forEach(entity => {
      const length = values.length;

      Object.keys(keyMap).forEach(key => {
        values.push((typeof entity[key] === 'undefined') ? this.columns[key].default : entity[key]);
      });

      const paramPlaceholders = Object.keys(keyMap).map((_, index) => `$${length + index + 1}`).join(', ');

      valuesExpressions.push(`(${paramPlaceholders})`);
    });

    const insertQuery = `INSERT INTO "${this.table}" (${columnNames}) VALUES ${valuesExpressions.join(', ')}`;

    return { insertQuery, values };
  }

  protected buildSelectManyQuery(entities: Partial<TEntity>[]): { selectQuery: string, values: any[] } {
    const keyMap: any = {};

    entities.forEach(entity => {
      Object.keys(entity)
        .forEach(key => {
          keyMap[key] = true;
        });
    });

    const selectExpressions: string[] = [];
    const values: any[] = [];

    entities.forEach(entity => {
      const length = values.length;

      Object.keys(keyMap).forEach(key => {
        values.push((typeof entity[key] === 'undefined') ? this.columns[key].default : entity[key]);
      });

      const whereExpression = Object.keys(keyMap).map((_, index) => `(${this.columns[_].databasePath} = $${length + index + 1})`).join(' AND ');

      selectExpressions.push(`(select * from "${this.table}" where (${whereExpression}))`);
    });

    const selectQuery = selectExpressions.join(' UNION ');

    return { selectQuery, values };
  }

  map(raw: any): TEntity {
    const mapped = Object.values(this.columns)
      .reduce((entity: any, { propertyPath, databasePath, type }: TTableMeta) => {
        entity[propertyPath] = raw[databasePath];
        return entity;
      }, {} as any) as TEntity;

    return mapped;
  }

  async query(query: string, parameters: any[]) {
    if (this.debug) {
      console.log({ table: this.table, query, parameters });
    }

    const result = await this.repo.query(query, parameters);

    if (this.debug) {
      console.log({ table: this.table, query, parameters, result });
    }

    return result as any[];
  }

  async queryAndMap(query: string, parameters: any[]) {
    const result = await this.query(query, parameters);

    return result?.map((_: any) => this.map(_)) as TEntity[];
  }
}
