const { digest } = require('./complianceDecisionService');

class PrismaGovernanceRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  createPolicy(record) {
    return this.prisma.governancePolicy.create({ data: record });
  }

  getPolicy(id) {
    return this.prisma.governancePolicy.findUnique({ where: { id } });
  }

  findLatestSource(sourceKey) {
    return this.prisma.regulatorySource.findFirst({ where: { sourceKey }, orderBy: { version: 'desc' } });
  }

  createSource(record) {
    return this.prisma.regulatorySource.create({ data: record });
  }

  getSource(id) {
    return this.prisma.regulatorySource.findUnique({ where: { id } });
  }

  createEvaluation(record) {
    return this.prisma.complianceEvaluation.create({ data: record });
  }

  getEvaluation(id) {
    return this.prisma.complianceEvaluation.findUnique({ where: { id } });
  }

  updateEvaluation(id, changes) {
    return this.prisma.complianceEvaluation.update({ where: { id }, data: changes });
  }

  appendAudit(record) {
    return this.prisma.$transaction(async transaction => {
      const latest = await transaction.governanceAuditEvent.findFirst({
        where: { aggregateId: record.aggregateId },
        orderBy: { sequence: 'desc' },
      });
      const previousHash = latest ? latest.hash : 'GENESIS';
      const sequence = latest ? latest.sequence + 1 : 1;
      return transaction.governanceAuditEvent.create({
        data: {
          ...record,
          hash: digest({ previousHash, record }),
          previousHash,
          sequence,
        },
      });
    });
  }

  listAudit(aggregateId) {
    return this.prisma.governanceAuditEvent.findMany({ where: { aggregateId }, orderBy: { sequence: 'asc' } });
  }

  listPolicies() {
    return this.prisma.governancePolicy.findMany({ orderBy: [{ policyKey: 'asc' }, { version: 'desc' }] });
  }

  listSources() {
    return this.prisma.regulatorySource.findMany({ orderBy: [{ sourceKey: 'asc' }, { version: 'desc' }] });
  }

  listEvaluations() {
    return this.prisma.complianceEvaluation.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
  }
}

module.exports = PrismaGovernanceRepository;
