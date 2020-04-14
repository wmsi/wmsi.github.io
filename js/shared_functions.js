// Shared functions between different versions of the STEM Resource Table (ie master and dev branches)
//TODO: reorder functions from most- to least-used
var url = "https://us-central1-sigma-tractor-235320.cloudfunctions.net/http-proxy";
// var url = "https://wmsinh.org/airtable?query=" + query_string;
// var url = "https://wmsinh.org/airtable";
// var url = "https://us-central1-sigma-tractor-235320.cloudfunctions.net/http-proxy";
// var url = "http://localhost:5000/airtable";
var fav_sources = ["WMSI", "STEAM Discovery Lab", "NASA", "code.org"];
var search_results = [];

/*
    Obtain search results and cache them locally while displaying pages one at a time
    @param {int} page_size - number of results to render per page
    TODO: make final decision on multiPageLoad(), consider implementing here
*/
function renderPages(page_size) {
    var timer = Date.now();
    var query_string = _getQueryString();
    var page_size = parseInt($('#results-per-page').val());
    var data = {query: query_string};
    // var search_results = [];

    _displayLoading(true);
    $('.grid-container').show()

    // cache activities locally (pending speed test)
    if(search_results.length > 0) {
        _displayResults(search_results, page_size);
        console.log("Render results time: ", Date.now() - timer);
    } else {
        _getResults(url, data).then(function(data, status, jqXHR) {
            if(!_safeParse(data, search_results))
                return _handleSearchFail();
            _displayResults(search_results, page_size);
        console.log("Initial load time: ", Date.now() - window.performance.timing.navigationStart);
        }).fail(() => _handleSearchFail());
    }
}

/*
    Display results from search_results in Featured Activities and in the table
    @param {object} search_results - list of activities to display
    @param {int} page_size - number of results to display on a page.
*/
function _displayResults(search_results, page_size) {
    _manageTableLocal(search_results, page_size);
    _renderFeatures(search_results);
    _displayLoading(false);
    document.querySelector('#feature-container').scrollIntoView({ 
      behavior: 'smooth' 
    });
}

/*     
    Execute AJAX GET request and return response data
    @param {string} url - URL to request from
    @param {object} data - includes Airtable query and page_size or offset
    @private
*/
function _getResults(url, data) {
    return $.ajax({
        data: data,
        // headers: {'Access-Control-Allow-Origin': '*'},
        url: url
    });
}


/*
    Parse the response data or push it directly if it is an array
    @param {object} data - response data from http proxy
    @param {array} search_results - array to append search results onto
    @private
    TODO: expand exception handling to include other cases.
*/
function _safeParse(data, search_results) {
    try {
        // var new_results=JSON.parse(data);
        Array.prototype.push.apply(search_results, JSON.parse(data));
    } catch (err) {
        // console.log('parse failed, attempting push', err);
        try {
            Array.prototype.push.apply(search_results, data);
        } catch {
            // console.log('cannot parse search results', err);
            return false;
        }
    }
    return true;
}

/*
    Display a message to users if a search fails. This could have to do with a bad
    HTTP request, connectivity issues, or unforeseen problems.
    @private
*/
function _handleSearchFail() {
    _displayLoading(false);
    $('#results-meta').html(`We're sorry but there was an error loading your search.  
                            Please refresh the page and try again. 
                            If the problem persists, click the "Broken Link" button on the bottom right.`);
}

/*
    Generate HTML for all resources returned by a search query. 
    Called by renderTable()
    @param {array} search_resutls - resources returned by a query search to airtable
    @param {string} env - current deployment denvironment
    @private
    TODO: phase out env argument for production
*/
function _buildTable(search_results, env='production') {
    // console.log('building ' + search_results.length + ' resources');
    var new_elements;
    var grid_item = "<span class='item'>*</span>";
    search_results.forEach(function(resource, index) {
        var activity_link = grid_item.replace('*', '<a target="_blank" href="'+ resource["Resource Link"] +'">'+ resource["Resource Name"] +'</a>');
        if(resource['Tags'].includes('incomplete')) 
            activity_link = _adaptActivity(resource, index);
        
        new_elements = activity_link;
        author_link = '<a target="_blank" href="' + resource["Source Link"] + '">' + resource["Source"] + '</a>'
        new_elements += grid_item.replace('*', author_link);
        new_elements += grid_item.replace('*', resource["Duration"]);
        new_elements += grid_item.replace('*', resource["Experience"]);
        new_elements += grid_item.replace('*', resource["Subject"]);
        new_elements += grid_item.replace('*',  "<center><big><a href='#' data-featherlight='#resource" + index + "'>&#9432;</a></big></center>");

        $('#content').append(new_elements); 
        _addLightbox(resource, index);
        (env == 'dev') ? _commentSection(resource, index, 'Test Comments') : _commentSection(resource, index);;
    }); 
}

/*
    Render the comments section for an activity. At this point
    comments may be displayed as a preview (tooltip) with mouse hover,
    or as a ligthbox with full comments and form to leave your own 
    (triggered on mouse click).
    @param {object} resource - resource to render comments for
    @param {int} index - index of the resource for creating IDs
    @param {string} key - field in Airtable to draw comments from
    @private
*/
function _commentSection(resource, index, key='Comments') {
    var element = "<span class='item'>" + $('#comment-template').html() + "</span>";
    var text_id = '#new-comment' + index; 
    var form_id = '.featherlight-inner #comment-form'+index;
    
    // make sure each tooltip positions on top of other elements
    element = element.replace('*pos', 200-index).replace('*title', resource["Resource Name"]).replace('*link', resource["Resource Link"]);
    element = element.replace(/@index/g, index);

    $('#content').append(element);

    if(resource[key] != undefined) {
        var comments = JSON.parse('['+resource[key]+']');
        var markup = '<br>';

        comments.forEach(comment => {markup += comment[0] + ': ' + comment[1] + '<br>'});
        var preview = '<br>' + (markup.length > 60 ? markup.slice(0, 60) + '...' : markup);

        $('#comment-hover'+index + ' b').empty().html('User comments preview:').after(preview);
        $('#comment-text'+index + ' h4').empty().html('User Comments:').after(markup);
        $('#comment-badge'+index).html(comments.length.toString());
    }
    // $(form_id).hide();
    $(text_id).unbind('focus').focus(function() {
        $(this).css('height','90px');
        $(form_id).show();
    });
    _postComment(resource, index);
}

/*
    Add Comment section to the bottom of a feature lightbox from the carousel
    Comment form remains hidden until user clicks on the comment box
    @param {object} resource - activity to build comments section for
    @param {int} index - index of the resource in the features carousel
    @private
*/
function _addFeatureComments(resource, index) {
    // var comments = "";
    var id = '#feature'+index;
    // var comments = $('#comment-template .comment-box').html();
    var element = $('#feature-comment-template').html().replace(/@index/g, index);
    var form_id = '.featherlight-inner #feature-comment-form'+index;
    $(id).append(element);
    if(resource.Comments != undefined) {
        // comments += "<b>User Comments: "
        $(id + ' h4').empty().html("User Comments: ");
        var comments = JSON.parse('['+resource.Comments+']');
        // console.log('appending ' + comments + ' to ' + id);
        comments.forEach(comment => {$('#feature-comment-text' + index).append(comment[0] + ': ' + comment[1] + '<br>')});
    } 

    $('#feature-new-comment'+index).unbind('focus').focus(function() {
        $(this).css('height','90px');
        $(form_id).show();
    });
    _postComment(resource, index, true);
}

/*
    Handle the event of a user posting a new comment on a featured activity
    When a user clicks the Post Comment button parse the comment text 
    and send it to Airtable
    @param {int} index - index of activity in the table, used to make IDs
    @param {object} resource - resource object to post comment for
    @private
    TODO: shorter ID names?
*/
function _postComment(resource, index, feature = false) {
    // var id = '#feature-post-comment' + index;
    var id = (feature ? '#feature-post-comment' + index : '#post-comment' + index);
    var comment_id = (feature ? '#feature-new-comment' + index : '#new-comment' + index);
    var user_id = (feature ? '#feature-comment-name' + index : '#comment-name' + index);

    $(id).unbind('click').click(function() {
        var comment = $('.featherlight-inner ' + comment_id).val();
        var user = $('.featherlight-inner ' + user_id).val();
        user = (user == "" ? "Anonymous" : user);
        if(comment != '') {
            var formatted_comment = '["' + user + '", "' + comment + '"]';
            console.log('posting comment: '+ comment +' to airtable from user ' + user);
            $.ajax({
                type: 'POST',
                // url: 'https://wmsinh.org/airtable',
                // url: 'http://localhost:5000/airtable',
                // url: "https://us-central1-sigma-tractor-235320.cloudfunctions.net/http-proxy",
                data: {
                    "id": resource.id,
                    "New Comment": formatted_comment
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.log("post comment failed :( \n" + textStatus + ': ' + errorThrown);
            });

            // Wait for approval on new comments. Show some kind of success message that comment was received
            var markup_id = '.featherlight-inner ' + (feature ? '#feature-' : '#') + 'comment-text' + index;
            $(markup_id).empty().append('<b>Thanks for posting a comment! We will review your comment within the next 1-2 weeks and put it right here.');
            // $('.featherlight-inner #feature-comment-text'+index).append(user + ': ' + comment + '<br>');
            $('.featherlight-inner ' + comment_id).val('');
            $('.featherlight-inner ' + user_id).val('');
        }
    });
}

/*
    Render 3 Featured Activities at the top of the page. 
    Call helper function to build ordered list of relevant features 
    based on ratings and other criteria.
    @param {array} search_results - list of activites returned based on a user search

    TODO: Refine selection criteria, limit duplicate Source
*/
function _renderFeatures(search_results) {
    // console.log('rendering features');
    feature_list = _buildFeatureList(search_results);
    // console.log('building ' + feature_list.length + ' features');
    if(feature_list.length == 0)
        $('#feature-container').hide();
    else {
        $('#feature-container').show();
        _buildFeatures(feature_list);
    }
}

/*
    Create three features to appear above the table. Features can fit whatever criteria we want-
    Right now the first one always comes from a list of 'best authors' and the other two are random
    @param {array} features - a list of activities that could be used as features. Currently this
        is all activities with an "Img URL" field
    @private
*/
function _buildFeatures(features) {
    features = features.slice(0,3);

    $('.features').empty();
    features.map(function(resource, i) {
        var template = $('#featured-activity-template').html();

        template = template.replace(/@index/g, i);
        template = template.replace(/@title/g, resource["Resource Name"]);
        template = template.replace('*link', resource["Resource Link"]);
        template = template.replace('*img', 'src="'+resource.Thumbnail[0].url+'"');
        template = template.replace('*description', resource['Description']);
        template = template.replace('*subjects', resource['Subject']);//(Array.isArray(item["Subject"]) ? item["Subject"].join(", ") : item["Subject"]));
        template = template.replace('*materials', resource['Materials']);
        template = template.replace('*source', resource['Source']);
        template = template.replace('*src_link', resource['Source Link']);
        $('.features').append(template);
        if(resource["Youtube URL"] != undefined)
            _addVideo(resource, '#feature' + i);
        _addFeatureComments(resource, i);
    });
}

/* 
    Reset all filters to their default values
*/
function resetFilters() {
    $('#subject').val("");
    $('#experience').val("");
    $(':checkbox').prop('checked',true);
    $('#self-led').prop('checked', false);
    $('input[type="search"]').val("");
}


/*
    Build an ordered list of featured activities based on search results
    Most relevant/ highly rated activities sort towards the top of list.
    TODO: Continue to refine criteria for sorting/ filtering
            Ideally we end up with one sort() and one filter()

    @param {list} search_results - list of resource objects returned from airtable search
    @param {int} max - max number of features to return
    @returns {list} feature_list - featured activities sorted with most relevant towards the top
    @private
    TODO: time permitting, improve selection algorithm to create a 'short list' of best features
        for user search, then randomize
*/
function _buildFeatureList(search_results, max=100) {
    var feature_list = [];
    var top_features = [];

    // randomize the results
    search_results.sort(() => Math.random() - 0.5);

    search_results.forEach(function(resource) {
        if(resource.Thumbnail != undefined && !resource.Tags.includes('incomplete')) {
            // save Top Features from favorite sources
            if(fav_sources.includes(resource.Source) || resource.Tags.includes('favorite'))
                top_features.push(resource);

            // push all other items to list that have a thumbnail and are not incomplete
            else 
                feature_list.push(resource);
        }
    });

    // no duplicate sources next to each other
    feature_list = feature_list.filter(function(resource, i, feature_list) {
        if(i == 0)
            return true;
        return !(resource.Source == feature_list[i-1].Source);
    });

    // add Top Feature to beginning (just one for now)
    if(top_features.length)
        feature_list.unshift(top_features[0]);

    if(max < feature_list.length)
        feature_list = feature_list.slice(0, max);

    return feature_list;
}

/*
    Build a query string for the Airtable API. This query will take into account all filters 
    and the text-based search.
    @private

    TODO: Do we want to require at least one search criteria?
*/
function _getQueryString() {
    var query = "AND(";
    if($('#subject').val() != "") 
        query += "Find('" + $('#subject').val() + "', Subject), ";
        // search_params.push("Subject=" + $('#subject').val());

    if($('#experience').val() != "") 
        query += "Find('" + $('#experience').val() + "', Experience), ";

    if($('#self-led').is(':checked'))
        query += "Find('self-led', Tags), ";

    query += _getMaterialsQuery();

    // split search text on spaces (and punctuation?) then use AND() to add them to query
    if($('input[type="search"]').val() != '')
        query += "AND(Find('" + $('input[type="search"]').val().toLowerCase().split(' ').join("', {Search Text}), Find('") + "', {Search Text})), ";
        // query += "Find('" + $('input[type="search"]').val().toLowerCase() + "', {Search Text}), ";

    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + ")";
    
    // Bring this back if we want to require search criteria (e.g. base gets large)
    if(query == "AND)")
        query = "NOT({Resource Name}='')"
    //     alert('Please use at least one search option to find resources.');

    return query;
}

/*
    Helper function for _getQueryString
    Compile all the materials checkboxes into part of the Airtable query
    @private

    TODO: handle if user doesn't check any boxes, ask them to check at least one
*/
function _getMaterialsQuery() {
    var query = "OR(";

    var all_materials = true;
    // Check to see if all materials are selected
    $('#materials-filter :checkbox').each(function(i, el) {
        all_materials = $(this).is(':checked');
        return all_materials;
    });

    if(all_materials)
        return "";

    if($('#browser').is(':checked'))
        query += "Find('Computer w/ Browser', Materials), ";
    if($('#pen-paper').is(':checked'))
        query += "Find('Pen and Paper', Materials), ";
    if($('#craft').is(':checked'))
        query += "Find('Crafting Materials', Materials), ";
    if($('#tablet').is(':checked'))
        query += "Find('Tablet', Materials), ";
    if($('#robotics').is(':checked'))
        query += "Find('Robotics', Materials), ";
    if($('#lab-materials').is(':checked'))
        query += "Find('Lab Materials', Materials), ";

    if(query == "OR(")
        return "";

    string_preslice = query;
    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + "), ";
    return query;
}

/*
    Sort search results by field values. Event triggered when user clicks an 
    arrow next to one of the column headers
    @param {array} search_results - activities returned by Airtable
    @returns {boolean} true if table was built from existing sort, false if no build happens
    @private
    TODO: we could avoid calling this with every search by keeping a permanent reference to
        search_results
*/
function _sortResults(search_results, build=true) {
    $('.item-header i').unbind('click').click(function() {
        var ascending = $(this).attr('class') == 'up' ? true : false;
        var field = $(this).parent().attr('id');
        
        console.log('sorting by ' + field + ' with build ' + build);
        if(field == "activity")
            _sortText(search_results, "Resource Name", ascending);
        if(field == "author")
            _sortText(search_results, "Source", ascending);
        if(field == "time")
            _sortTime(search_results, ascending);
        if(field == "experience")
            _sortExperience(search_results, ascending);
        if(field == "subject")
            _sortText(search_results, "Subject", ascending)
        if(field == "rating")
            _sortRating(search_results, ascending);
        if(build) {
            _clearTable();
            _buildTable(search_results);
        }
        $('i').css('border-color', 'black');
        $('i').removeAttr('alt');
        $(this).css('border-color', 'green');
        $(this).attr('alt', 'selected');
    });
    // if sort exists from previous search apply it to this one
    $('i[alt="selected"]').click();
    if($('i[alt="selected"]').length)
        return true;
    else
        return false;
}

/*
    Show the Scroll to Top Button when the user scrolls the filters out of view.
*/
function scrollTopButton() {
    if($(window).scrollTop() > 670) 
        $('.scroll-top').show();
    else
        $('.scroll-top').hide();
}

/*
    Modify html template to create a lightbox with "Info" for an activity
    This includes a thumbnail if the activity has one, link to the activity,
    activity description, and activity tags.
    @param {object} resource - resource object as returned from Airtable
    @param {int} index - number of the activity in the search results. 
        also the html id number for this element
    @private

    TODO: create lightbox with generic thumbnail image if no thumbnail exists. 
        continue to evaluate what content fits best here
*/
function _addLightbox(resource, index) {
    var html_template = $('#info-lightbox-template').html();
    html_template = html_template.replace('*id', 'resource' + index);
    html_template = html_template.replace('*class', 'lightbox-grid');
    html_template = html_template.replace('*link', resource["Resource Link"]);
    html_template = html_template.replace('*title', resource["Resource Name"]);
    if(resource.Thumbnail != undefined && resource["Youtube URL"] == undefined) 
        html_template = html_template.replace('*img','src="' + resource.Thumbnail[0].url + '"');
    // else generic thumbnail image
    html_template = html_template.replace('*description', resource["Description"]);
    html_template = html_template.replace('*materials', resource["Materials"]);
    html_template = html_template.replace('*tags', resource.Tags);
    if(resource["Tags"].includes("incomplete"))  
        html_template = html_template.slice(0,html_template.indexOf('</div>')) +  _adaptLightbox();
    $('#content').append(html_template);
    if(resource["Youtube URL"] != undefined)
        _addVideo(resource, '#resource' + index);
}

/*
    Add a video streaming option if the Youtube URL field is defined for this resource
    v1: embed with HTML5 <video> tag. Evaluate for compatibility
    @param {object} resource - resource to render video for
    @param {string} id - element ID to add video
    @private
*/
function _addVideo(resource, id) {
    // var $thumbnail = $(id + ' img').detach();

    console.log('prepending video to ' + id + ' a');
    var video_template = $("#lightbox-video-template").html();
    video_template = video_template.replace('*src', 'src="' + resource["Youtube URL"] + '"');
    var $video = $(id + ' a').first().append(video_template);
    // $thumbnail.appendTo($video);

}

/*
    Add the Adaptation Activity template to an activity lightbox.
    @private
*/
function _adaptLightbox() {
    return $('#adapt-text-template').html() + '</div>';
} 

/*
    Create a special lightbox for any activity that does not meet our lesson standards,
    and so requires adaptation by a teacher in order to be run as a classroom activity
    @param {resource} resource - Link to the activity page
    @param {int} index - activity index number used for building element IDs
    @private
*/
function _adaptActivity(resource, index) {
    // console.log('adapting template for ' + resource["Resource Name"]);
    var markup = $('#adapt-lightbox-template').html();
    markup = markup.replace(/@id/g, 'adapt'+index);
    markup = markup.replace('*class', 'item');
    markup = markup.replace(/title/g, resource["Resource Name"]);
    markup = markup.replace('*link', resource["Resource Link"]);
    return markup;
}

/*
    Reveal a the More Info lightbox for a resource
    @param {int} index - index of the resource in the table

    TODO: use this function instead of FeatherlightJS for lightboxes
*/
function showLightbox(index) {
    var id = '#resource' + index;
    $(id).show();
}

/*
    Update a rating after it has been posted to the database
    This function changes the html for an activity's rating to 
    reflect the new user input.
    @param {object} resource - 
    @param {float} rating - new rating for the activity
    @param {int} votes - number of votes, including the one just made
    @private
*/
function _updateStars(element, name, rating, votes) {
    rating = Number.isInteger(rating) ? rating : rating.toFixed(2);
    var rating_string = rating + '/5 by ' + votes + ' votes';
    parent = $(this).parent();
    $(element).parent().parent().find('small').html(rating_string);

    // var markup = $('#stars-template').html().replace('stars-id', name);
    // markup = markup.replace('rating', Number.isInteger(rating) ? rating : rating.toFixed(2));
    // markup = markup.replace('num', votes + (votes == 1 ? ' vote' : ' votes'));
}

/*
    Display a spinner graphic to show that results are still loading
    @param {boolean} loading - true to show the spinner, false to hide it
    @private
*/
function _displayLoading(loading) {
    if(loading)
        $('.lds-ring').show();// $('#load-div').show();
    else
        $('.lds-ring').hide();//$('#load-div').hide();
}

/*
    Clear the table from previous search results
    @private
*/
function _clearTable() {
    $('.item').remove();
    $('.lightbox-grid').remove();
}

/*
    Re-set the tab indexes in lightbox functions so they don't all
    have tabindex=-1. This is a known bug with featherlight as referenced here:
    https://github.com/noelboss/featherlight/issues/285
    TODO: make our own lightboxes to avoid dealing with this
    @private
*/
function _fixTabIndex() {
    $.featherlight.defaults.afterOpen = function() {
        var count = 1;
        new_lightbox = this;
        this.$instance.find('input, textarea, button').each(function() {
            $(this).attr('tabindex', count++);
        });
    };
}



////////////////////////////// PAGE FUNCTIONS ////////////////////////////////////////
/*
    Change the number of results displayed per page
    Call renderPage() to load a new page size from Airtable
    @param {int} start - search_resutls index of the current first activity 
        (used to find page number)
    @private
*/
function changePageLength(start) {
    var page_size = $('#results-per-page').val();
    var page = Math.floor(start/page_size);
    console.log('new page length ' + page_size +' and page num ' + page);
    renderPage(page_size, page);
}

/*
    Change the number of results displayed per page
    Call _manageTableLocal() to load a new page of results
    @param {int} start - search_resutls index of the current first activity 
        (used to find page number)
    @param {array} search_results - all activities that match the current search
    @private
*/
function changePageLengthLocal(start, search_results) {
    var page_size = $('#results-per-page').val();
    var page = Math.floor(start/page_size);
    console.log('new page length ' + page_size +' and page num ' + page);
    _manageTableLocal(search_results, page_size, page);
}

/*
    Display results meta data above the table. Meta data includes length of results,
    results per page, current page number, etc.
    @param {array} search_results - records returned by airtable
    @param {int} page_size - max number of records per page
    @private
*/
function _displayMetaData(search_results, page_size, page_num=0, num_results=search_results.length) {
    // console.log('display meta for page num ' + page_num +', page size ' + page_size + ', num results ' + num_results);

    $('#results-meta').empty();
    if(num_results == 0)
        $('#results-meta').html("We're sorry but your search did not return any results.");
    else if(num_results == 1)
        $('#results-meta').html("Displaying " + search_results.length + " Result.");
    else if(search_results.length < num_results) {         // pagination in effect
        var start = page_size*page_num + 1;
        var end = page_size*(page_num + 1) < num_results ? page_size*(page_num + 1) : num_results;
        $('#results-meta').html("Displaying " + start + "-" + end + " of " + num_results + " Results.");
    } else {
        $('#results-meta').html("Displaying " + search_results.length + " Results.");
    }
}

/*
    Attach behavior to Next Page and Last Page buttons using locally stored results
    Unbind any functions previously attached to those buttons
    Change styling to reflect (in)active buttons
    @param {array} search_results - all results that match the current search
    @param {int} page_size - number of results to render per page
    @param {int} page - current page number
    @private
*/
function _createLocalButtons(search_results, page_size, page=0) {
    var next_page = (page+1)*page_size < search_results.length ? true : false;
    var last_page = page > 0 ? true : false;
    // console.log('create buttons with next '+ next_page + ' and last ' + last_page);
    $('.next-page').unbind('click');
    $('.last-page').unbind('click');

    if(next_page) {
        $('.next-page').click(function() {
            _manageTableLocal(search_results, page_size, page+1);
            document.querySelector('#feature-container').scrollIntoView({ 
              behavior: 'smooth' 
            });
        });
    }

    if(last_page) {
        $('.last-page').click(function() {
            _manageTableLocal(search_results, page_size, page-1);
            document.querySelector('#feature-container').scrollIntoView({ 
              behavior: 'smooth' 
            });
        });
    }

    if(next_page || last_page) 
        $('#bottom-page-buttons').show();
    else
        $('#bottom-page-buttons').hide();

    _buttonCss(next_page, last_page);
}

/*
    Alter CSS for page buttons depending on table state
    Inactive button is grey and doesn't act like a link
    @param {boolean} next_page - true if there is a next page in the table
    @param {boolean} last_page - true if there is a previous page in the table
    @private
*/
function _buttonCss(next_page, last_page) {
    // console.log('modifying button css with next ' + next_page + ' and last ' + last_page);
    if(next_page) {
        $('.next-page').css({'cursor': '', 'color': ''});
    } else {
        $('.next-page').unbind('click');
        $('.next-page').css({'cursor': 'default', 'color': 'grey'});   
    }
    if(last_page) {
        $('.last-page').css({'cursor': '', 'color': ''});
    } else {
        $('.last-page').unbind('click');
        $('.last-page').css({'cursor': 'default', 'color': 'grey'});
    }
}



////////////////////////////// SORT FUNCTIONS ////////////////////////////////////////
/* Used for sorting resources based on field values. Called by _sortResults()   */

/*
    Sort results by text field in alphabetical order
    Currently this is the default if no other sort is selected
    @param {array} search_results - Airtable activities based on search options
    @param {string} field - resource field key to sort by
    @param {boolean} ascending - true = a to z, false = z to a
    @private
*/
function _sortText(search_results, field, ascending) {
    if(ascending)
        search_results.sort((a, b) => a[field].localeCompare(b[field]));
    else
        search_results.sort((a, b) => b[field].localeCompare(a[field]));
    return search_results;
}

/*
    Sort results by the duration of the activity
    @param {array} search_results - Airtable activities based on search options
    @param {boolean} ascending - true = short to long, false = long to short
    @private
    TODO: how well do we want to handle edge cases of 1h00+, 1-2 hours, etc.?
*/
function _sortTime(search_results, ascending) {
    search_results.sort(function(a, b) {

        var a_time = parseFloat(a.Duration.replace('h','.'));
        var b_time = parseFloat(b.Duration.replace('h','.'));
        if(ascending)
            return a_time - b_time;
        else
            return b_time - a_time;
    });
}

/*
    Sort results by the experience required for an activity
    @param {array} search_results - Airtable activities based on search options
    @param {boolean} ascending - true = low to high, false = high to low
    @private
*/
function _sortExperience(search_results, ascending) {
    var exp = ["Early Learner","Beginner","Intermediate","Advanced"];
    search_results.sort(function(a, b) {
        var a_experience = a.Experience.includes(",") ? a.Experience.split(",")[0] : a.Experience;
        var b_experience = b.Experience.includes(",") ? b.Experience.split(",")[0] : b.Experience;
        if(ascending)
            return exp.indexOf(a_experience) - exp.indexOf(b_experience);
        else
            return exp.indexOf(b_experience) - exp.indexOf(a_experience);
    });
}

////////////////////////////// SEARCH FUNCTIONS ////////////////////////////////////////
/* Used for sorting resources based on field values. Called by _sortResults()   */

/*
    Apply the grade range filter to an array of activities and return a filtered array
    @param {array} activities - array to filter
    @returns {array} of activities that match the user-defined grade level
    @private
*/
function _applyGradeFilter(activities) {
    var grade_filter = $('#grade').val();
    var render_activities = [];
    // console.log('applying grade filter to ' + activities.length + ' activities');

    if(grade_filter != "") {
        if(grade_filter === 'K') grade_filter = 0;
        else grade_filter = parseInt(grade_filter);

        $.each(activities, function(index, item) {
            if(grade_filter >= item["Grade Range"].low && grade_filter <= item["Grade Range"].high)
                render_activities.push(item);
        });
    } else render_activities = activities;

    console.log('returning ' + render_activities.length + ' activities');
    return render_activities;
}

/*
    Parent function for rendering the drop down menus at the top of the table
    Populate each menu with the options available in the activities array
    @private
*/
function _renderSelects() {
    subjects = ["Science", "Engineering", "Math", "Social Studies", "Language Arts", "Computer Science",  "Music", "Visual Arts", "Physical Education"];
    _renderSelect("#subject","Subject", subjects);
    // _renderGradeSelect();
    _renderExperienceSelect();
}

/*
    Add options to a dropdown menu
    @param {string} id - HTML id of the dropdown to create
    @param {string} key - JSON key in the Activity object that corresponds to the options for this menu
    @private
*/
function _renderSelect(id, key, data) {
    var select_options = $(id).children().toArray().map(i => i.innerHTML);
    var new_options = [];
    data.forEach(item => new_options.push(item));

    $(id).append(
        $.map(new_options, function(item) {
            return '<option value="' + item + '">' + item + '</option>';
        }).join());
}

/*
    Add options to the experience level dropdown menu
    Give users optiosn for beginner, intermediate, advanced
    @private
*/
function _renderExperienceSelect() {
    var grade_options = ['Early Learner','Beginner','Intermediate','Advanced'];
    $('#experience').append(
        $.map(grade_options, function(item) {
            return '<option value="' + item + '">' + item + '</option>';
        }).join());
}

/*
    Start a new search if the user presses "Enter" after typing in the search box.
    With the new (non-datatables) implementation this could also be handled by
    making the search bar part of a form with a Submit button
*/
function _handleSearch() {
    $('input[type="search"]').on('keydown', function(e) {
        if (e.which == 13) {
            $('#search').click();
        }
    });
}
































////////////////////////////// DEPRECATED ////////////////////////////////////////

/*
    Handle the event of a user posting a new comment on an activity
    When a user clicks the Post Comment button parse the comment text 
    and send it to Airtable
    @param {int} index - index of activity in the table, used to make IDs
    @param {object} resource - resource object to post comment for
    @private

    Deprecated - new function posts to 'New Comments' pending approval and combines with features
*/
function _postCommentDEPRECATED(index, resource) {
    var id = '#post-comment' + index;
    $(id).unbind('click').click(function() {
        var comment = $('.featherlight-inner #new-comment' + index).val();
        var user = $('.featherlight-inner #comment-name' + index).val();
        user = (user == "" ? "Anonymous" : user);
        if(comment != '') {
            var formatted_comment = '["' + user + '", "' + comment + '"]';
            console.log('posting comment: '+ comment +' to airtable from user ' + user);
            if(resource.Comments)
                resource.Comments = resource.Comments + ', ' + formatted_comment;
            else
                resource.Comments = formatted_comment
            $.ajax({
                    type: 'POST',
                    url: 'https://wmsinh.org/airtable',
                    // url: 'http://localhost:5000/airtable',
                    data: {
                        "id": resource.id,
                        "Comment": formatted_comment
                    }
                });
            $('.featherlight-inner #comment-text'+index).append(user + ': ' + comment + '<br>');
            $('.featherlight-inner #new-comment'+index).val('');
            $('.featherlight-inner #comment-name'+index).val('');
        }
    });
}

/*
    Handle an event when stars are clicked in order to post a new rating to Airtable
    Post ratings using Ajax request to a secure API proxy, in order to hide API key
    @param {array} search_results - list of resources returned by Airtable from a user-generated search
    @private
*/
function _postRatings(search_results) {
    $('.star').unbind('click').click(function() {
        var name = $(this).parent().attr('id');
        var rating = $(this).attr('id').split('star')[1];
        if(confirm("Do you want to post a rating of " +rating+"/5 to "+name+"?")) {
            var resource = search_results.find(x => x["Resource Name"] == name);
            var votes = (resource.Votes == undefined ? 0 : resource.Votes);
            var new_rating = (resource.Rating*votes + parseInt(rating))/(++votes);
            if(resource.Rating == undefined) 
                new_rating = parseInt(rating);
            console.log('posting rating of ' + new_rating + ' based on ' + votes + ' votes');
            _updateStars(this, name, new_rating, votes);

            $.ajax({
                type: 'POST',
                url: 'https://wmsinh.org/airtable',
                // url: 'http://localhost:5000/airtable',
                data: {
                    "id": resource.id,
                    "Rating": new_rating,
                    "Votes": votes
                }
            });
        }
    });
}

/*
    Add rating column for an activity. As of 1/12/20 this feature is being
    rendered as responsive stars to click for a rating and a number/10 
    existing rating.
    @param {object} resrouce - Airtable resource object
    @private
*/
function _starsMarkup(resource) {
    var markup = $('#stars-template').html().replace('stars-id', resource["Resource Name"]);
    if(resource.Rating == undefined)
        markup = markup.replace('rating/5 by num','');
    else {
        markup = markup.replace('rating', Number.isInteger(resource.Rating) ? resource.Rating : resource.Rating.toFixed(2));
        markup = markup.replace('num', resource.Votes + (resource.Votes == 1 ? ' vote' : ' votes'));
    }

    return markup;
}


/*
    Sort results by Rating from high to low
    Currently this is the default if no other sort is selected
    @param {array} search_results - Airtable activities based on search options
    @private
*/
function _sortRating(search_results, ascending=false) {
    search_results.sort(function(a, b) {
        var a_rating = a.Rating == undefined ? 0 : a.Rating;
        var b_rating = b.Rating == undefined ? 0 : b.Rating;
        if(ascending)
            return a_rating - b_rating;
        else
            return b_rating - a_rating;
    });
}

function _buildFeaturesDEP(features) {
    $(".featured-activity").each(function(i) {
        $(this).empty();
        if(!features[i])
            return true;
        var feature_id = 'feature' + (i + 1);
        var subjects = Array.isArray(features[i]["Subject"]) ? features[i]["Subject"].join(", ") : features[i]["Subject"];
        var feature_div = `
            <a href="#" data-featherlight="#`+ feature_id +`"><div class="feature"><img class="feature" src="`+ features[i]["Thumbnail"][0].url +`" /></div><br />
            <span>`+ features[i]["Resource Name"] +`</span></a>
                <div style="display: none"><div id="`+ feature_id +`" style="padding: 10px;">
                    <h3><a target="_blank" href="`+ features[i]["Resource Link"] +`">`+ features[i]["Resource Name"] +`</a></h3>
                    <br />`+ features[i]["Description"] +`<br /><br />
                    <b>Experience: </b>`+ features[i]["Experience"] +`<br />
                    <b>Subject: </b>`+ subjects +`<br />
                    <b>Materials: </b>`+ features[i]["Materials"] +`<br />
                    <b>Author: </b><a href="`+ features[i]["Source Link"] +`">`+ features[i]["Source"] +`</a><br>   
                </div>`;
                    // <b>Rating: </b>` + _starsMarkup(features[i]) + `
                
        $(this).append(feature_div);
        _addFeatureComments(features[i], i+1);
    });
    // _postRatings(features);
}

/*
    Create a lightbox to house the "More Info" text for an activity
    This includes a thumbnail if the activity has one, link to the activity,
    activity description, and activity tags.
    @param {object} resource - resource object as returned from Airtable
    @param {int} index - number of the activity in the search results. 
        also the html id number for this element
    @private

    TODO: create lightbox with generic thumbnail image if no thumbnail exists. 
        continue to evaluate what content fits best here
*/
function _addLightboxDEPRECATED(resource, index) {
    var html_template = `<div class='ligthbox-grid' id='*id' hidden>
            *link
            <br />
            <span><center>*description</center></span><br /><hr>
            <span>*materials</span><br />
            <span>*tags</span>
        </div>`;
    var author_info = "<a target='_blank' href='" + resource["Source Link"] + "'>" + resource.Source + "</a>";

    html_template = html_template.replace('*id', 'resource' + index);
    if(resource["Tags"].includes("incomplete")) 
        html_template = html_template.replace('*link', _adaptActivityLightbox(resource, index));
    else {
        html_template = html_template.replace('*link', "<a target='_blank' href='*link'>*img<span align='center'><h3>*title</h3><span></a>");
        html_template = html_template.replace('*link', resource["Resource Link"]);
        if(resource.Thumbnail != undefined) 
            html_template = html_template.replace('*img',"<img class='lightbox' src='" + resource.Thumbnail[0].url + "'>");
        html_template = html_template.replace('*title', resource["Resource Name"]);
    }
    html_template = html_template.replace('*description', resource["Description"]);
    if(resource.Materials != "None")
        html_template = html_template.replace('*materials',  "This activity requires the following materials: " + resource["Materials"]);
    html_template = html_template.replace('*tags', "Keyword tags: " + resource.Tags);
    // $('.grid-container').append(html_template);
    $('#content').append(html_template);
}

/*
    Add a code-interpretable grade range to an activity in the array
    'K' get stored as grade 0. The upper limit for unbounded range is 12
    @param {array} data- activities that need a grade range added
    @private
*/
function _addGradeRange(data=resource_table.Activities) {
    $.each(data, function(index, item) {
        item["Grade Range"] = {};
        var low = item["Grade Level"][0];
        var high;

        if(item["Grade Level"][item["Grade Level"].length-1] === '+') {
            high = 12;
        } else {
            high = parseInt(item["Grade Level"].split('-')[1]);
        }

        if(low === 'K') low = 0;
        else low = parseInt(low);

        item["Grade Range"]["low"] = low;
        item["Grade Range"]["high"] = high;
    });
}

/*
    Add options to the grade level dropdown menu
    Give users all grade options from K-12
    @private
*/
function _renderGradeSelect() {
    var grade_options = ['K','1','2','3','4','5','6','7','8','9','10','11','12'];
    $('#grade').append(
        $.map(grade_options, function(item) {
            return '<option value="' + item + '">' + item + '</option>';
        }).join());
}

function _adaptActivityDEPRECATED(activity_link, index, name) {
    // console.log('building adaptation with link: ' + activity_link);
    // var resource_link = '<a href="#" target="_blank" data-featherlight="#adapt' + index + '">' + name + '</a>';
    var resource_link = '<span class="item"><a href="#" target="_blank" data-featherlight="#adapt' + index + '">' + name + '</a></span>';
    resource_link += '<div style="display: none"><div id="adapt' + index + '" style="padding: 10px;">';
    resource_link += `<div class="header"><img src="images/adapt-icon.png"><h3>Thank you for choosing one of our activities for adaptation!</h3></div>
        <br />
        This is a resource that we believe can be helpful, but currently does include a full lesson plan. We consider this activity to be <b>primed for CS Ed</b> and we believe it could be creatively adapted to fit your classroom needs. You can find the original activity page at the link below.
        <div style="padding-top: 1em">`;
    resource_link += activity_link;
    resource_link += `</div>
            <br />
            If you choose to work with this activity we'd love to collect some information on how it went! This will help us cultivate and improve the activities on this page and assist teachers who want to use this activity in the future. Please <a href="https://www.whitemountainscience.org/resource-table-contact-form">click here</a> to provide us with feedback.
            </div>
        </div>`;
    return resource_link;
}

/*
    Update the options available in a dropdown based on what's in the table
    @private

    TODO: Since this only applies to Subjects now the following two functions could
    be re-written to deal with this one case. 
*/
function _updateSelects(data=resource_table.Activities) {
    _renderSelect("#subject","Subject", data);
}

/*
    Display some text or graphic to show that the resources are still loading
    @param {boolean} loading - indicates whether the loading placeholder is to be
        displayed or not
    @private
*/
// function _displayLoading(loading) {
//     if(loading)
//         $('#load-div').show();
//     else
//         $('#load-div').hide();
// }

