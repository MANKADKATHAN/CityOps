-- Create the foreign key relationship to allow joining on user_id
alter table complaints
add constraint fk_complaints_user
foreign key (user_id)
references profiles (id)
on delete set null;
