# Business Rules Skill

Every business rule must be explicit.

Do not hide business rules inside:
- Controllers
- ORM models
- SQL queries
- Flutter widgets

Business rules must be represented by:
- Domain entities
- Value objects
- Domain services
- Use cases

Example:

An appointment cannot overlap another active appointment
for the same staff member.

This rule must be tested independently of MySQL.