import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IEntityProvider } from '../types/entity-provider.interface';

export class TypeOrmRepository<TEntity> implements IEntityProvider<
  TEntity,
  FindOneOptions<TEntity>,
  FindManyOptions<TEntity>,
  FindOptionsWhere<TEntity>,
  QueryDeepPartialEntity<TEntity>
> {
  constructor(private entityType: any, public entityManager: EntityManager) { }

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

  async put(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>) {
    // await this.repo.save(options, body); <= this doesn't do what i expected,
    // so just call patch instead
    await this.patch(options, body);
  }

  async patch(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>) {
    await this.repo.update(options, body);
  }

  protected get repo() {
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
}
