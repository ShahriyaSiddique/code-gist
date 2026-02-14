import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { Snippets } from './entities/snippets.entity';
import { SnippetShare } from './entities/snippet-share.entity';
import { ShareSnippetDto } from './dto/share-snippet.dto';

@Injectable()
export class SnippetsService {
    constructor(
        @InjectRepository(Snippets)
        private snippetRepository: Repository<Snippets>,
        @InjectRepository(SnippetShare)
        private snippetShareRepository: Repository<SnippetShare>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async findAll(userId?: string): Promise<Snippets[]> {
        const queryBuilder = this.snippetRepository
            .createQueryBuilder('snippet')
            .leftJoinAndSelect('snippet.user', 'user');

        if (userId) {
            // Only snippets created by the current user (excludes public & shared-with-me)
            queryBuilder.where('snippet.user.id = :userId', { userId });
        } else {
            queryBuilder.where('snippet.isPublic = :isPublic', { isPublic: true });
        }

        return queryBuilder.getMany();
    }

    async create(createSnippetDto: CreateSnippetDto, user: User): Promise<{ id: string; }> {
        const snippets = this.snippetRepository.create({
            ...createSnippetDto,
            user,
        });
        const savedSnippet = await this.snippetRepository.save(snippets);
        return { id: savedSnippet.id };
    }

    async findOne(id: string, userId?: string): Promise<Snippets> {
        const snippet = await this.snippetRepository.findOne({
            where: { id },
            relations: ['user', 'shares', 'shares.sharedWith'],
        });

        if (!snippet) {
            throw new NotFoundException('Snippet not found');
        }

        if (userId && !(await this.hasAccessToSnippet(id, userId))) {
            throw new ForbiddenException('You do not have access to this snippet');
        }

        return snippet;
    }

    async findOnePublic(id: string): Promise<Snippets> {
        const snippet = await this.snippetRepository.findOne({
            where: { id },
            relations: ['user'],
        });

        if (!snippet) {
            throw new NotFoundException('Snippet not found');
        }

        if (!snippet.isPublic) {
            throw new ForbiddenException('This snippet is not public');
        }

        return snippet;
    }

    async update(id: string, updateSnippetDto: UpdateSnippetDto, userId: string): Promise<Snippets> {
        const snippets = await this.findOne(id, userId);
        if (snippets.user.id !== userId && snippets.shares.some(share => share.sharedWith.id !== userId)) {
            throw new ForbiddenException('You can only update your own snippets');
        }
        Object.assign(snippets, updateSnippetDto);
        return this.snippetRepository.save(snippets);
    }

    async remove(id: string, userId: string): Promise<boolean> {
        const snippets = await this.findOne(id, userId);
        if (snippets.user.id !== userId) {
            throw new ForbiddenException('You can only delete your own snippets');
        }
        const result = await this.snippetRepository.delete(id);
        return result.affected > 0;
    }

    async shareSnippet(snippetId: string, shareDto: ShareSnippetDto, ownerId: string): Promise<void> {
        const snippet = await this.findOne(snippetId, ownerId);
        if (snippet.user.id !== ownerId) {
            throw new ForbiddenException('You can only share your own snippets');
        }

        // Remove existing shares for this snippet
        await this.snippetShareRepository.delete({ snippet: { id: snippetId } });

        // Create new shares
        const sharePromises = shareDto.userIds.map(async (userId) => {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            const share = this.snippetShareRepository.create({
                snippet,
                sharedWith: user,
            });
            return this.snippetShareRepository.save(share);
        });

        await Promise.all(sharePromises);
    }

    private async hasAccessToSnippet(snippetId: string, userId: string): Promise<boolean> {
        const snippet = await this.snippetRepository.findOne({
            where: { id: snippetId },
            relations: ['user', 'shares', 'shares.sharedWith'],
        });

        if (!snippet) {
            return false;
        }

        if (snippet.isPublic) {
            return true;
        }

        if (snippet.user.id === userId) {
            return true;
        }

        return snippet.shares.some(share => share.sharedWith.id === userId);
    }

    async findShared(userId: string): Promise<Snippets[]> {
        return this.snippetRepository
            .createQueryBuilder('snippet')
            .leftJoinAndSelect('snippet.user', 'user')
            .leftJoinAndSelect('snippet.shares', 'shares')
            .leftJoinAndSelect('shares.sharedWith', 'sharedWith')
            .where('sharedWith.id = :userId', { userId })
            .getMany();
    }
}