from backend.services.graph_service import graph_service
from backend.models.graph import EntityCreate, RelationshipCreate

def seed_acme_corp():
    """Seed the knowledge graph with the reengineered structure from the diagram"""
    
    # Check if data already exists
    if len(graph_service.get_all_entities()) > 0:
        print("Knowledge Graph already has data. Skipping seed.")
        return

    print("Seeding Reengineered Knowledge Graph...")

    # 1. Domains
    channels = graph_service.create_entity(EntityCreate(name="Channels", type="domain", description="Business domain for sales and communication channels"))
    products = graph_service.create_entity(EntityCreate(name="Products", type="domain", description="Business domain for product management"))
    customers = graph_service.create_entity(EntityCreate(name="Customers", type="domain", description="Business domain for customer management"))
    orders = graph_service.create_entity(EntityCreate(name="Orders", type="domain", description="Business domain for order processing"))

    # 2. People
    inv_manager = graph_service.create_entity(EntityCreate(name="Inventory Manager", type="person"))
    ec_manager = graph_service.create_entity(EntityCreate(name="E-commerce Manager", type="person"))
    cs_manager = graph_service.create_entity(EntityCreate(name="Customer Service Manager", type="person"))

    # 3. Business Metadata (Diamond shapes in diagram)
    best_products = graph_service.create_entity(EntityCreate(name="Best selling Products", type="metadata_business"))
    cac = graph_service.create_entity(EntityCreate(name="Customer Acquisition Costs", type="metadata_business"))
    active_custs = graph_service.create_entity(EntityCreate(name="Active Customers", type="metadata_business"))
    total_revenue = graph_service.create_entity(EntityCreate(name="Total Revenue", type="metadata_business"))

    # 4. Technical Metadata
    ec_metadata = graph_service.create_entity(EntityCreate(name="E-Commerce Metadata", type="metadata_technical"))
    erp_metadata = graph_service.create_entity(EntityCreate(name="ERP Metadata", type="metadata_technical"))
    crm_metadata = graph_service.create_entity(EntityCreate(name="CRM Metadata", type="metadata_technical"))

    # 4b. Data Products
    revenue_data = graph_service.create_entity(EntityCreate(
        name="Monthly Revenue Data", 
        type="data_product", 
        description="Tabular revenue data for last 6 months",
        metadata={
            "tabular_data": {
                "headers": ["Month", "Revenue ($)", "Status"],
                "rows": [
                    ["August", "120,000", "Finalized"],
                    ["September", "145,000", "Finalized"],
                    ["October", "138,000", "Finalized"],
                    ["November", "190,000", "Finalized"],
                    ["December", "250,000", "Finalized"],
                    ["January", "180,000", "Draft"]
                ]
            }
        }
    ))

    # 5. Processes
    prod_intro_proc = graph_service.create_entity(EntityCreate(name="New Product Introduction Process", type="process"))
    order_ful_proc = graph_service.create_entity(EntityCreate(name="Order Fulfillment Process", type="process"))
    cust_acq_proc = graph_service.create_entity(EntityCreate(name="Customer Acquisition Process", type="process"))

    # 6. Policies
    social_policy = graph_service.create_entity(EntityCreate(name="Social Media Policy", type="policy"))
    qa_policy = graph_service.create_entity(EntityCreate(name="Quality Assurance Policy", type="policy"))
    return_policy = graph_service.create_entity(EntityCreate(name="Order Return & Refund Policy", type="policy"))
    privacy_policy = graph_service.create_entity(EntityCreate(name="Customer Data Privacy Policy", type="policy"))

    # Relationships - Domain Core
    domain_rels = [
        (channels, customers), (customers, orders), (orders, products), (products, channels),
        (channels, orders), (products, customers)
    ]
    for src, tgt in domain_rels:
        graph_service.create_relationship(RelationshipCreate(sourceId=src.id, targetId=tgt.id, type="related_domain"))

    # Relationships - Products
    graph_service.create_relationship(RelationshipCreate(sourceId=products.id, targetId=inv_manager.id, type="managed_by"))
    graph_service.create_relationship(RelationshipCreate(sourceId=products.id, targetId=best_products.id, type="has_metadata"))
    graph_service.create_relationship(RelationshipCreate(sourceId=products.id, targetId=prod_intro_proc.id, type="follows_process"))
    graph_service.create_relationship(RelationshipCreate(sourceId=products.id, targetId=qa_policy.id, type="governed_by"))

    # Relationships - Channels
    graph_service.create_relationship(RelationshipCreate(sourceId=channels.id, targetId=social_policy.id, type="governed_by"))
    graph_service.create_relationship(RelationshipCreate(sourceId=channels.id, targetId=ec_metadata.id, type="has_technical_metadata"))
    graph_service.create_relationship(RelationshipCreate(sourceId=channels.id, targetId=inv_manager.id, type="involved_people"))
    graph_service.create_relationship(RelationshipCreate(sourceId=channels.id, targetId=cac.id, type="has_metadata"))
    graph_service.create_relationship(RelationshipCreate(sourceId=channels.id, targetId=ec_manager.id, type="involved_people"))

    # Relationships - Customers
    graph_service.create_relationship(RelationshipCreate(sourceId=customers.id, targetId=ec_manager.id, type="involved_people"))
    graph_service.create_relationship(RelationshipCreate(sourceId=customers.id, targetId=active_custs.id, type="has_metadata"))
    graph_service.create_relationship(RelationshipCreate(sourceId=customers.id, targetId=crm_metadata.id, type="has_technical_metadata"))
    graph_service.create_relationship(RelationshipCreate(sourceId=customers.id, targetId=cust_acq_proc.id, type="follows_process"))
    graph_service.create_relationship(RelationshipCreate(sourceId=customers.id, targetId=privacy_policy.id, type="governed_by"))
    graph_service.create_relationship(RelationshipCreate(sourceId=customers.id, targetId=cs_manager.id, type="involved_people"))

    # Relationships - Orders
    graph_service.create_relationship(RelationshipCreate(sourceId=orders.id, targetId=cs_manager.id, type="involved_people"))
    graph_service.create_relationship(RelationshipCreate(sourceId=orders.id, targetId=total_revenue.id, type="has_metadata"))
    graph_service.create_relationship(RelationshipCreate(sourceId=orders.id, targetId=erp_metadata.id, type="has_technical_metadata"))
    graph_service.create_relationship(RelationshipCreate(sourceId=orders.id, targetId=return_policy.id, type="governed_by"))
    graph_service.create_relationship(RelationshipCreate(sourceId=orders.id, targetId=order_ful_proc.id, type="follows_process"))
    graph_service.create_relationship(RelationshipCreate(sourceId=orders.id, targetId=revenue_data.id, type="has_data_product"))
    graph_service.create_relationship(RelationshipCreate(sourceId=revenue_data.id, targetId=total_revenue.id, type="populates"))

    print("Reengineered Seed Data completed.")
