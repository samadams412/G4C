# Eventify Database by G4C

##- Navigation
    - "../seeds/.." contains the necessary files python needed to generate dummy data programatically.
    - "../db/.." contains all *.sql* files.
      - "../db/analysis/.." contains several *.sql* files each containing example queries, seperated by domain.
      - "../db/automation/.." contains example lifecycle *.sql* scripts as well as triggers and procedures.
      - "../db/dummy_data.sql" is a generated dummy data file resulting from one of the scripts in */seeds.*
      - "../db/schema.sql contains the database schema."

##- Setup 
  To run locally, clone the project and in your console, run 
      ***mysql -u root -p;***
      ***source db/schema.sql;***
      \*Any of your *.py* scripts in *seeds* to generate data (optional)*
      ***source db/dummy_data.sql*** (or run one of the *.py* scripts in *seeds* to generate new dummy data).
    
