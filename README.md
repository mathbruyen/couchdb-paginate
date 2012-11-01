# Middleware helping pagination of CouchDB views

## Usage

With an [ExpressJS](http://expressjs.com/) application:

```javascript
var paginate = require('couchdb-paginate');
app.get('/list/:start', paginate(config), function (req, res) {
  // See documentation on how to setup config
  // Send response using req.documents, ...
})
```

## Development

### Generate documentation

Run `docco index.js` (possibly adding `node_modules/.bin` to the path). Requires [Pygments](http://pygments.org/)
that is used used by [docco](http://jashkenas.github.com/docco/).

### Run tests

Run `grunt` (possibly adding `node_modules/.bin` to the path). Requires [CouchDB](https://couchdb.apache.org/) but
creates a local database.

# Licence

MIT, see `license.txt`.